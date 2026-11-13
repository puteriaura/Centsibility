import assert from 'node:assert/strict';
import { asRole, expectError, seedKid, seedParent } from './harness.mjs';

async function family(db) {
  const parent = await seedParent(db);
  const kid = await seedKid(db, parent, { name: 'Test Saver', balance: 100, coins: 100 });
  return { parent, kid: kid.id };
}

function call(db, sql, params) {
  return asRole(db, 'service_role', () => db.query(sql, params));
}

async function notes(db, parent, children, expectedKids, expectedParent = []) {
  const kidRows = (await db.query(
    'select kid_id, kind, message, link, read from public.kid_notifications where kid_id = any($1::uuid[])',
    [children],
  )).rows;
  const parentRows = (await db.query(
    'select parent_id, kid_id, kind, message, link, read from public.notifications where parent_id = $1',
    [parent],
  )).rows;
  const kidExpected = expectedKids.map(([kid_id, kind, message, link]) => ({ kid_id, kind, message, link, read: false }));
  const parentExpected = expectedParent.map(([kid_id, kind, message, link]) => ({ parent_id: parent, kid_id, kind, message, link, read: false }));
  for (const [actual, expected] of [[kidRows, kidExpected], [parentRows, parentExpected]]) {
    assert.equal(actual.length, expected.length);
    for (const row of expected) assert(actual.some(other => Object.keys(row).every(key => row[key] === other[key])), JSON.stringify(row));
  }
}

export const tests = [
  {
    name: 'Parent sends to child',
    fn: async db => {
      const { parent, kid } = await family(db);
      await call(db, "select parent_send_to_kid($1,$2,5,null,'Parent')", [parent, kid]);
      await notes(db, parent, [kid], [[kid, 'TRANSFER', 'Parent sent you RM5.00.', '/kid/history']]);
    },
  },
  {
    name: 'Child sends to parent',
    fn: async db => {
      const { parent, kid } = await family(db);
      await call(db, "select kid_send_to_parent($1,5,null,'Parent')", [kid]);
      await notes(db, parent, [kid],
        [[kid, 'TRANSFER', 'You sent RM5.00 to Parent.', '/kid/history']],
        [[kid, 'TRANSFER', 'Test Saver sent you RM5.00', '/parent']]);
    },
  },
  {
    name: 'Child sends to sibling',
    fn: async db => {
      const { parent, kid } = await family(db);
      const sibling = (await seedKid(db, parent, { name: 'Test Sibling' })).id;
      await call(db, 'select kid_send_to_sibling($1,$2,5,null)', [kid, sibling]);
      await notes(db, parent, [kid, sibling], [
        [kid, 'TRANSFER', 'You sent RM5.00 to Test Sibling.', '/kid/history'],
        [sibling, 'TRANSFER', 'Test Saver sent you RM5.00.', '/kid/history'],
      ], [[kid, 'TRANSFER', 'Test Saver sent RM5.00 to Test Sibling.', '/parent']]);
    },
  },
  {
    name: 'Child gives Sadaqah',
    fn: async db => {
      const { parent, kid } = await family(db);
      await call(db, "select kid_give_sadaqah($1,10,'Orphan Relief')", [kid]);
      await notes(db, parent, [kid],
        [[kid, 'SADAQAH', 'You gave RM10.00 to Orphan Relief. +20 points', '/kid/sadaqah']],
        [[kid, 'SADAQAH', 'Test Saver gave RM10.00 sadaqah to Orphan Relief', '/parent']]);
    },
  },
  {
    name: 'Child earns a quest reward',
    fn: async db => {
      const parent = await seedParent(db);
      const { id: kid } = await seedKid(db, parent, { age_group_override: '10-12' });
      const { id, title, points } = (await db.query(
        "select id,title,points from public.quests where age_group='10-12' and position=1 and active",
      )).rows[0];
      const questions = (await db.query(
        'select id,correct_index from public.quest_questions where quest_id=$1 order by position', [id],
      )).rows;
      const { attemptId } = (await call(db, 'select kid_quest_start($1,$2) as data', [kid, id])).rows[0].data;
      for (const question of questions) {
        await call(db, 'select kid_quest_answer($1,$2,$3,$4)', [kid, attemptId, question.id, question.correct_index]);
      }
      await notes(db, parent, [kid], [[kid, 'REWARD', `Quest complete: ${title}. +${points} points`, '/kid/missions']]);
    },
  },
  {
    name: 'Child investment settles',
    fn: async db => {
      const { parent, kid } = await family(db);
      const { id } = (await call(db, "select kid_investment_open($1,'low','week',2,20) as data", [kid])).rows[0].data;
      await db.query("update public.investments set created_at=now()-interval '3 weeks' where id=$1", [id]);
      const { paid } = (await call(db, 'select kid_investments_settle($1) as data', [kid])).rows[0].data;
      assert(Number(paid) > 0);
      await notes(db, parent, [kid], [[kid, 'INVESTMENT',
        `Your Low fund finished. RM20.00 became RM${Number(paid).toFixed(2)} and is back in your spending money.`, '/kid/invest']]);
    },
  },
  {
    name: 'Parent resolves deposit, withdrawal, loan and transfer requests',
    fn: async db => {
      const { parent, kid } = await family(db);
      const sibling = (await seedKid(db, parent, { name: 'Test Sibling' })).id;
      const expected = [];
      for (const approve of [true, false]) {
        for (const [kind, label, link] of [
          ['DEPOSIT', 'deposit', '/kid/wallet'],
          ['WITHDRAWAL', 'withdrawal', '/kid/wallet'],
          ['QARD', 'loan request', '/kid/loans'],
          ['TRANSFER', '', '/kid/history'],
        ]) {
          const { id } = (await db.query(
            "insert into public.approvals (kid_id,kind,amount,reason,to_kid_id) values ($1,$2,10,'Test',$3) returning id",
            [kid, kind, kind === 'TRANSFER' ? sibling : null],
          )).rows[0];
          const sql = "select resolve_approval($1,$2,$3,current_date+7,'Test',null)";
          await call(db, sql, [id, parent, approve]);
          await expectError(call(db, sql, [id, parent, approve]), 'already_resolved');
          if (kind !== 'TRANSFER') {
            expected.push([kid, kind, `Your ${label} of RM10.00 was ${approve ? 'approved' : 'declined'}`, link]);
          } else if (approve) {
            expected.push([kid, kind, 'Your RM10.00 to Test Sibling was approved and sent.', link]);
            expected.push([sibling, kind, 'Test Saver sent you RM10.00.', link]);
          } else {
            expected.push([kid, kind, 'Your RM10.00 to Test Sibling was not approved.', '/kid']);
          }
        }
      }
      await notes(db, parent, [kid, sibling], expected);
    },
  },
  {
    name: 'Parent approves and declines rewards',
    fn: async db => {
      const { parent, kid } = await family(db);
      for (const approve of [true, false]) {
        const { id } = (await db.query(
          "insert into public.rewards (kid_id,name,cost,status) values ($1,'Test reward',10,'requested') returning id", [kid],
        )).rows[0];
        await call(db, 'select resolve_reward($1,$2,$3)', [id, parent, approve]);
        await expectError(call(db, 'select resolve_reward($1,$2,$3)', [id, parent, approve]), 'already_resolved');
      }
      await notes(db, parent, [kid], [
        [kid, 'REWARD', 'Your reward request was approved', '/kid/missions'],
        [kid, 'REWARD', 'Your reward request was declined', '/kid/missions'],
      ]);
    },
  },
  {
    name: 'Scheduled Hibah reaches child and parent once',
    fn: async db => {
      const { parent, kid } = await family(db);
      await db.query(
        "insert into public.scheduled_hibahs (parent_id,kid_id,amount,frequency,start_date,next_run_at) values ($1,$2,5,'weekly',now(),now())",
        [parent, kid],
      );
      for (const count of [1, 0]) {
        assert.equal((await call(db, 'select execute_due_hibahs() as count', [])).rows[0].count, count);
      }
      await notes(db, parent, [kid], [[kid, 'HIBAH', 'You received RM5.00 Hibah', '/kid/history']],
        [[kid, 'HIBAH', 'RM5.00 Hibah paid to Test Saver', '/parent']]);
    },
  },
  {
    name: 'Parent adds and removes money directly',
    fn: async db => {
      const { parent, kid } = await family(db);
      for (const kind of ['DEPOSIT', 'WITHDRAWAL']) {
        await call(db, 'select parent_move_money($1,$2,$3,5,null)', [kid, parent, kind]);
      }
      await notes(db, parent, [kid], [
        [kid, 'DEPOSIT', 'Your parent added RM5.00', '/kid/wallet'],
        [kid, 'WITHDRAWAL', 'Your parent took out RM5.00', '/kid/wallet'],
      ]);
    },
  },
  {
    name: 'Child repayment tells the parent the amount paid',
    fn: async db => {
      const { parent, kid } = await family(db);
      const { id } = (await db.query(
        "insert into public.loans (kid_id,amount,due_date,status) values ($1,10,current_date+7,'active') returning id", [kid],
      )).rows[0];
      await call(db, 'select kid_repay_loan($1,$2,15)', [kid, id]);
      await expectError(call(db, 'select kid_repay_loan($1,$2,15)', [kid, id]), 'loan_closed');
      await notes(db, parent, [kid], [], [[kid, 'QARD', 'Test Saver repaid RM10.00 of a loan', '/parent']]);
    },
  },
];
