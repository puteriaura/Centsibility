import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: 'Refuses invalid amounts on approval, parent moves and repayments',
    async fn(db) {
      const parent = await seedParent(db);
      const kid = await seedKid(db, parent, { balance: 50 });
      for (const amount of [-5, 0.001, 999999999, 5.555, 3.333]) {
        const { rows: [approval] } = await db.query(
          "insert into approvals (kid_id, kind, amount, reason) values ($1, 'DEPOSIT', $2, 'test') returning id",
          [kid.id, amount],
        );
        await asRole(db, 'service_role', async () => {
          await expectError(db.query('select resolve_approval($1, $2, true)', [approval.id, parent]), 'invalid_amount');
          await expectError(db.query("select parent_move_money($1,$2,'DEPOSIT',$3,null)", [kid.id, parent, amount]), 'invalid_amount');
          await expectError(db.query('select kid_repay_loan($1,$1,$2)', [kid.id, amount]), 'invalid_amount');
        });
        console.log(`Replay: refused ${amount}`);
      }
      assert.equal(Number((await db.query('select balance from kids where id=$1', [kid.id])).rows[0].balance), 50);
    },
  },
  {
    name: 'Overdue daily Hibah pays once, advances four days and tells the parent it skipped three',
    async fn(db) {
      const parent = await seedParent(db);
      const kid = await seedKid(db, parent);
      await db.query(
        "insert into scheduled_hibahs (parent_id,kid_id,amount,frequency,start_date,next_run_at) values ($1,$2,5,'daily','2026-11-11','2026-11-11')",
        [parent, kid.id],
      );
      const run = () => db.query("select execute_due_hibahs('2026-11-14T00:00:00Z') as paid");
      assert.equal((await run()).rows[0].paid, 1);
      assert.equal((await run()).rows[0].paid, 0);
      assert.equal((await db.query('select next_run_at::date::text as day from scheduled_hibahs where kid_id=$1', [kid.id])).rows[0].day, '2026-11-15');
      const { rows } = await db.query('select message from notifications where kid_id=$1', [kid.id]);
      assert.equal(rows.length, 1);
      assert.match(rows[0].message, /Skipped 3 missed Hibah/);
      console.log(`Replay: ${rows[0].message}`);
    },
  },
  {
    name: 'Sadaqah requires RM1 and accepts only known causes',
    async fn(db) {
      const parent = await seedParent(db);
      const kid = await seedKid(db, parent, { balance: 10, coins: 7 });
      await expectError(db.query("select kid_give_sadaqah($1,.50,'Local Masjid')", [kid.id]), 'invalid_amount');
      await expectError(db.query("select kid_give_sadaqah($1,1,'Unknown')", [kid.id]), 'invalid_cause');
      const { rows: [{ result }] } = await db.query("select kid_give_sadaqah($1,1,'Local Masjid') as result", [kid.id]);
      assert.equal(result.coins_awarded, 0);
      assert.equal(Number((await db.query('select coins from kids where id=$1', [kid.id])).rows[0].coins), 7);
      console.log('Replay: Sadaqah awarded 0 points');
    },
  },
  {
    name: 'Quiz trigger function has no browser execute grants',
    async fn(db) {
      for (const role of ['anon', 'authenticated']) {
        const { rows: [{ allowed }] } = await db.query(
          "select has_function_privilege($1, 'public.increment_quiz_total_correct()', 'execute') as allowed", [role],
        );
        assert.equal(allowed, false);
      }
    },
  },
];
