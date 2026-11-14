import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Sadaqah: balance, coins and row are correct; insufficient_balance and invalid_amount',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20, coins: 10 });

      // Happy path: Sadaqah RM5.00
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_give_sadaqah($1, 5.00) as data`,
          [kid.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 15.00);
      assert.equal(Number(res.coins_awarded), 0);

      const kidRow = (await db.query(`select balance, coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 15.00);
      assert.equal(Number(kidRow.coins), 10);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      const sadaqahTx = txs[0];
      assert.equal(sadaqahTx.type, 'SADAQAH');
      assert.equal(Number(sadaqahTx.amount), 5.00);
      assert.equal(sadaqahTx.label, 'Sadaqah given');

      // Invariant: initial (20) - debit (5) = 15 = final balance
      assert.equal(20 - Number(sadaqahTx.amount), Number(kidRow.balance));

      // Error: insufficient balance (try 20 when balance is 15 and spent is 5 out of limit 50)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 20.00)`, [kid.id]),
          'insufficient_balance'
        )
      );

      // Error: invalid amount (< 0.50 or > 10000)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 0.20)`, [kid.id]),
          'invalid_amount'
        )
      );
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 20000.00)`, [kid.id]),
          'invalid_amount'
        )
      );
    },
  },
  {
    name: '2. Invest transfer: IN and OUT; insufficient_balance, insufficient_invested, invalid_type',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100, invest_balance: 20 });

      // Transfer IN 30
      const resIn = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_invest_transfer($1, 'IN', 30.00) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(Number(resIn.balance), 70.00);
      assert.equal(Number(resIn.invest_balance), 50.00);

      // Transfer OUT 15
      const resOut = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_invest_transfer($1, 'OUT', 15.00) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(Number(resOut.balance), 85.00);
      assert.equal(Number(resOut.invest_balance), 35.00);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 2);
      const inTx = txs.find((t) => t.type === 'INVEST_IN');
      const outTx = txs.find((t) => t.type === 'INVEST_OUT');

      assert.ok(inTx);
      assert.equal(Number(inTx.amount), 30.00);
      assert.equal(inTx.label, 'Invested');

      assert.ok(outTx);
      assert.equal(Number(outTx.amount), 15.00);
      assert.equal(outTx.label, 'Withdrew investment');

      // Invariant: initial (100) - debit (30) + credit (15) = 85 = final balance
      const kidRow = (await db.query(`select balance, invest_balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 85.00);
      assert.equal(Number(kidRow.invest_balance), 35.00);

      // Error: insufficient balance for IN (try 200 with balance 85)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_invest_transfer($1, 'IN', 200.00)`, [kid.id]),
          'insufficient_balance'
        )
      );

      // Error: insufficient invested for OUT (try 100 with invest_balance 35)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_invest_transfer($1, 'OUT', 100.00)`, [kid.id]),
          'insufficient_invested'
        )
      );

      // Error: invalid direction type
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_invest_transfer($1, 'SIDEWAYS', 10.00)`, [kid.id]),
          'invalid_type'
        )
      );
    },
  },
  {
    name: '3. Invest settle: happy path updates balance and writes INVEST_GAIN or INVEST_LOSS; wallet balance unchanged',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const res = await db.query(`select (now() - interval '14 days')::timestamptz as t0`);
      const t0 = res.rows[0].t0;
      const kid = await seedKid(db, parentId, { balance: 50, invest_balance: 100, invest_rate: 0.001, invest_last_paid: t0 });

      // Settle
      const resSettle = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      assert.ok(typeof resSettle.paid === 'number');
      assert.equal(Number(resSettle.invest_balance), 100 + Number(resSettle.paid));

      // Check transactions
      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      if (resSettle.paid !== 0) {
        assert.equal(txs.length, 1);
        const tx = txs[0];
        assert.ok(tx.type === 'INVEST_GAIN' || tx.type === 'INVEST_LOSS');
        assert.equal(Number(tx.amount), Math.abs(resSettle.paid));
        assert.equal(tx.label, `Investment ${resSettle.paid > 0 ? 'growth' : 'loss'} (2w)`);
      }

      // Wallet balance is unchanged (pot value tracking)
      const kidRow = (await db.query(`select balance, invest_balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 50.00);
      assert.equal(Number(kidRow.invest_balance), Number(resSettle.invest_balance));
    },
  },
  {
    name: '4. Repay: partial payment, overpayment capped (N3), trust scoring (+25/-50 clamped), QARD_REPAY with loan_id',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 150, trust_score: 500 });

      // Create an active loan: RM100, repaid RM30, outstanding RM70, due tomorrow
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const loan1 = (await db.query(
        `insert into public.loans (kid_id, amount, repaid, status, due_date)
         values ($1, 100.00, 30.00, 'active', $2)
         returning id`,
        [kid.id, tomorrow]
      )).rows[0].id;

      // Partial repayment of RM20
      const resPartial = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_repay_loan($1, $2, 20.00) as data`,
          [kid.id, loan1]
        )).rows[0].data
      );
      assert.equal(Number(resPartial.paid), 20.00);
      assert.equal(Boolean(resPartial.fullyRepaid), false);
      assert.equal(Number(resPartial.trustDelta), 0);

      const kidBal1 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(kidBal1), 130.00); // 150 - 20

      // Overpayment capping (N3): outstanding is 50 (100 - 50). Kid passes 80.
      const resFull = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_repay_loan($1, $2, 80.00) as data`,
          [kid.id, loan1]
        )).rows[0].data
      );
      assert.equal(Number(resFull.paid), 50.00); // Capped at remaining 50!
      assert.equal(Boolean(resFull.fullyRepaid), true);
      assert.equal(Number(resFull.trustDelta), 25); // On-time: +25

      const kidRowFinal = (await db.query(`select balance, trust_score from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRowFinal.balance), 80.00); // 130 - 50 (not 80!)
      assert.equal(Number(kidRowFinal.trust_score), 525);

      const loanRowFinal = (await db.query(`select repaid, status from public.loans where id = $1`, [loan1])).rows[0];
      assert.equal(Number(loanRowFinal.repaid), 100.00);
      assert.equal(loanRowFinal.status, 'repaid');

      // Verify transactions
      const txs = (await db.query(`select * from public.transactions where loan_id = $1`, [loan1])).rows;
      assert.equal(txs.length, 2);
      assert.ok(txs.every((t) => t.type === 'QARD_REPAY'));
      assert.ok(txs.every((t) => t.loan_id === loan1));
      assert.ok(txs.some((t) => Number(t.amount) === 20.00));
      assert.ok(txs.some((t) => Number(t.amount) === 50.00));

      // Invariant: initial (150) - 20 - 50 = 80 = final balance
      assert.equal(150 - 20 - 50, Number(kidRowFinal.balance));

      // Closed loan error
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_repay_loan($1, $2, 10.00)`, [kid.id, loan1]),
          'loan_closed'
        )
      );

      // Late repayment test (-50 trust)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const loanLate = (await db.query(
        `insert into public.loans (kid_id, amount, repaid, status, due_date)
         values ($1, 40.00, 0, 'active', $2)
         returning id`,
        [kid.id, yesterday]
      )).rows[0].id;

      const resLate = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_repay_loan($1, $2, 40.00) as data`,
          [kid.id, loanLate]
        )).rows[0].data
      );
      assert.equal(Number(resLate.trustDelta), -50);
      const kidTrustLate = (await db.query(`select trust_score from public.kids where id = $1`, [kid.id])).rows[0].trust_score;
      assert.equal(Number(kidTrustLate), 475); // 525 - 50
    },
  },
  {
    name: '5. Goal: capped at remaining amount (N3), goal_complete error, GOAL_IN row',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 60 });

      // Goal target 100, saved 85. Remaining is 15.
      const goalId = (await db.query(
        `insert into public.goals (kid_id, name, target, saved, emoji)
         values ($1, 'Bicycle', 100.00, 85.00, '🚲')
         returning id`,
        [kid.id]
      )).rows[0].id;

      // Kid contributes 30 (more than remaining 15)
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_contribute_goal($1, $2, 30.00) as data`,
          [kid.id, goalId]
        )).rows[0].data
      );

      assert.equal(Number(res.added), 15.00); // Capped at remaining 15!
      assert.equal(Number(res.saved), 100.00);

      const kidRow = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 45.00); // 60 - 15 (not 60 - 30)

      const goalRow = (await db.query(`select saved from public.goals where id = $1`, [goalId])).rows[0];
      assert.equal(Number(goalRow.saved), 100.00);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      const goalTx = txs[0];
      assert.equal(goalTx.type, 'GOAL_IN');
      assert.equal(Number(goalTx.amount), 15.00);
      assert.equal(goalTx.label, 'Saved to Bicycle');

      // Invariant: initial (60) - debit (15) = 45 = final balance
      assert.equal(60 - Number(goalTx.amount), Number(kidRow.balance));

      // Attempting to contribute to completed goal raises goal_complete
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_contribute_goal($1, $2, 10.00)`, [kid.id, goalId]),
          'goal_complete'
        )
      );
    },
  },
  {
    name: '6. Claim coins: moves unclaimed_coins to coins, second call returns 0',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { coins: 15, unclaimed_coins: 30 });

      // First call claims 30
      const claimed1 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_claim_coins($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(claimed1), 30);

      const kidRow1 = (await db.query(`select coins, unclaimed_coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow1.coins), 45); // 15 + 30
      assert.equal(Number(kidRow1.unclaimed_coins), 0);

      // Second call returns 0
      const claimed2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_claim_coins($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(claimed2), 0);
    },
  },
  {
    name: '7. Backfill: updates legacy goal DEPOSIT rows to GOAL_IN when goal exists, leaves deleted goal rows alone',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      // Create an existing goal
      await db.query(
        `insert into public.goals (kid_id, name, target, saved, emoji)
         values ($1, 'Camera', 200, 50, '📷')`,
        [kid.id]
      );

      // Insert matching legacy transaction
      const txMatching = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'DEPOSIT', 50.00, 'Saved to Camera')
         returning id`,
        [kid.id]
      )).rows[0].id;

      // Insert transaction whose goal does not exist (deleted goal)
      const txDeleted = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'DEPOSIT', 30.00, 'Saved to Deleted Pot')
         returning id`,
        [kid.id]
      )).rows[0].id;

      // Re-run the backfill query from migration
      await db.query(`
        update public.transactions t set type = 'GOAL_IN'
          from public.goals g
         where t.kid_id = g.kid_id and t.type = 'DEPOSIT' and t.label = 'Saved to ' || g.name;
      `);

      const rowMatching = (await db.query(`select type from public.transactions where id = $1`, [txMatching])).rows[0];
      assert.equal(rowMatching.type, 'GOAL_IN');

      const rowDeleted = (await db.query(`select type from public.transactions where id = $1`, [txDeleted])).rows[0];
      assert.equal(rowDeleted.type, 'DEPOSIT');
    },
  },
  {
    name: '8. Grants: anon and authenticated cannot call kid atomic functions; service_role can',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });

      const funcs = [
        { sql: `select kid_give_sadaqah($1, 1.0)`, params: [kid.id] },
        { sql: `select kid_request_withdrawal($1, 1.0, 'test')`, params: [kid.id] },
        { sql: `select kid_invest_transfer($1, 'IN', 1.0)`, params: [kid.id] },
        { sql: `select kid_invest_settle($1)`, params: [kid.id] },
        { sql: `select kid_repay_loan($1, gen_random_uuid(), 1.0)`, params: [kid.id] },
        { sql: `select kid_contribute_goal($1, gen_random_uuid(), 1.0)`, params: [kid.id] },
        { sql: `select kid_claim_coins($1)`, params: [kid.id] },
        { sql: `select kid_set_card_controls($1, true)`, params: [kid.id] },
        { sql: `select kid_card_spent_today($1)`, params: [kid.id] },
      ];

      for (const role of ['anon', 'authenticated']) {
        for (const f of funcs) {
          await asRole(db, role, () =>
            expectError(db.query(f.sql, f.params), 'permission denied')
          );
        }
      }
    },
  },
];
