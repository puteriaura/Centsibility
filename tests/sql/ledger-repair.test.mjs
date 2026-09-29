import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Standard RM100 loan: QARD becomes 100, fees become FEE, sum equals 94.50',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      const now = new Date();
      const loanRes = await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 100.00, 'bicycle', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const loanId = loanRes.rows[0].id;

      // Seed old-style transactions with loan_id null
      const qardRes = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 94.50, 'Qard approved: bicycle', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const qardId = qardRes.rows[0].id;

      const fee1Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee1Id = fee1Res.rows[0].id;

      const fee2Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee2Id = fee2Res.rows[0].id;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 1);
      assert.equal(res.fee_rows_deleted, 0);

      // Verify QARD updated
      const qardAfter = (await db.query(`select * from public.transactions where id = $1`, [qardId])).rows[0];
      assert.equal(Number(qardAfter.amount), 100.00);
      assert.equal(qardAfter.loan_id, loanId);

      // Verify fee 1
      const fee1After = (await db.query(`select * from public.transactions where id = $1`, [fee1Id])).rows[0];
      assert.equal(fee1After.type, 'FEE');
      assert.equal(Number(fee1After.amount), 3.00);
      assert.equal(fee1After.loan_id, loanId);

      // Verify fee 2
      const fee2After = (await db.query(`select * from public.transactions where id = $1`, [fee2Id])).rows[0];
      assert.equal(fee2After.type, 'FEE');
      assert.equal(Number(fee2After.amount), 2.50);
      assert.equal(fee2After.loan_id, loanId);

      // Net change
      assert.equal(Number(qardAfter.amount) - Number(fee1After.amount) - Number(fee2After.amount), 94.50);
    },
  },
  {
    name: '2. Small RM4 loan: QARD becomes 4, service 3, processing 1, total 0',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);
      const now = new Date();

      const loanRes = await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 4.00, 'book', 'active', $2, ($2::timestamptz + interval '7 days')::date)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const loanId = loanRes.rows[0].id;

      const qardRes = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 0.00, 'Qard approved: book', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const qardId = qardRes.rows[0].id;

      const fee1Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee1Id = fee1Res.rows[0].id;

      const fee2Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee2Id = fee2Res.rows[0].id;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 1);
      assert.equal(res.fee_rows_deleted, 0);

      const qardAfter = (await db.query(`select * from public.transactions where id = $1`, [qardId])).rows[0];
      assert.equal(Number(qardAfter.amount), 4.00);
      assert.equal(qardAfter.loan_id, loanId);

      const fee1After = (await db.query(`select * from public.transactions where id = $1`, [fee1Id])).rows[0];
      assert.equal(fee1After.type, 'FEE');
      assert.equal(Number(fee1After.amount), 3.00);
      assert.equal(fee1After.loan_id, loanId);

      const fee2After = (await db.query(`select * from public.transactions where id = $1`, [fee2Id])).rows[0];
      assert.equal(fee2After.type, 'FEE');
      assert.equal(Number(fee2After.amount), 1.00);
      assert.equal(fee2After.loan_id, loanId);

      assert.equal(Number(qardAfter.amount) - Number(fee1After.amount) - Number(fee2After.amount), 0.00);
    },
  },
  {
    name: '3. RM3 loan: processing row deleted, service 3, total 0',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);
      const now = new Date();

      const loanRes = await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 3.00, 'pencil', 'active', $2, ($2::timestamptz + interval '7 days')::date)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const loanId = loanRes.rows[0].id;

      const qardRes = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 0.00, 'Qard approved: pencil', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const qardId = qardRes.rows[0].id;

      const fee1Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee1Id = fee1Res.rows[0].id;

      const fee2Res = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)
         returning id`,
        [kid.id, now.toISOString()]
      );
      const fee2Id = fee2Res.rows[0].id;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 1);
      assert.equal(res.fee_rows_deleted, 1);

      const qardAfter = (await db.query(`select * from public.transactions where id = $1`, [qardId])).rows[0];
      assert.equal(Number(qardAfter.amount), 3.00);
      assert.equal(qardAfter.loan_id, loanId);

      const fee1After = (await db.query(`select * from public.transactions where id = $1`, [fee1Id])).rows[0];
      assert.equal(fee1After.type, 'FEE');
      assert.equal(Number(fee1After.amount), 3.00);
      assert.equal(fee1After.loan_id, loanId);

      // Fee 2 deleted
      const fee2Check = await db.query(`select * from public.transactions where id = $1`, [fee2Id]);
      assert.equal(fee2Check.rows.length, 0);

      assert.equal(Number(qardAfter.amount) - Number(fee1After.amount), 0.00);
    },
  },
  {
    name: '4. Unmatched disbursement: no loan row, counted as unmatched and left alone',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      const qardRes = await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 50.00, 'Qard approved: ghost loan', now(), null)
         returning id`,
        [kid.id]
      );
      const qardId = qardRes.rows[0].id;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 0);
      assert.equal(res.unmatched, 1);

      const qardAfter = (await db.query(`select * from public.transactions where id = $1`, [qardId])).rows[0];
      assert.equal(Number(qardAfter.amount), 50.00);
      assert.equal(qardAfter.loan_id, null);

      // Clean up unmatched test row so subsequent idempotency test sees 0 unmatched
      await db.query(`delete from public.transactions where id = $1`, [qardId]);
    },
  },
  {
    name: '5. Multiple loans a few seconds apart match correctly by amount and timestamp',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      const t1 = new Date(Date.now() - 30000);
      const t2 = new Date(Date.now() - 10000);

      const loan1 = (await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 100.00, 'first loan', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, t1.toISOString()]
      )).rows[0];

      const loan2 = (await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 50.00, 'second loan', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, t2.toISOString()]
      )).rows[0];

      const q1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 94.50, 'Qard approved: first loan', $2, null) returning id`,
        [kid.id, t1.toISOString()]
      )).rows[0];

      await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)`,
        [kid.id, t1.toISOString()]
      );
      await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)`,
        [kid.id, t1.toISOString()]
      );

      const q2 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 44.50, 'Qard approved: second loan', $2, null) returning id`,
        [kid.id, t2.toISOString()]
      )).rows[0];

      await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)`,
        [kid.id, t2.toISOString()]
      );
      await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)`,
        [kid.id, t2.toISOString()]
      );

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 2);

      const q1After = (await db.query(`select * from public.transactions where id = $1`, [q1.id])).rows[0];
      const q2After = (await db.query(`select * from public.transactions where id = $1`, [q2.id])).rows[0];

      assert.equal(q1After.loan_id, loan1.id);
      assert.equal(Number(q1After.amount), 100.00);

      assert.equal(q2After.loan_id, loan2.id);
      assert.equal(Number(q2After.amount), 50.00);
    },
  },
  {
    name: '6. Second run is idempotent (0 repaired, 0 unmatched)',
    fn: async (db) => {
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );
      assert.equal(res.repaired, 0);
      assert.equal(res.unmatched, 0);
    },
  },
  {
    name: '7. Rows already with loan_id (T3 rows) are not touched',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);
      const now = new Date();

      const loan = (await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 20.00, 't3 loan', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, now.toISOString()]
      )).rows[0];

      const qard = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 20.00, 'Qard approved: t3 loan', $2, $3) returning id`,
        [kid.id, now.toISOString(), loan.id]
      )).rows[0];

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 0);
      const qardAfter = (await db.query(`select * from public.transactions where id = $1`, [qard.id])).rows[0];
      assert.equal(qardAfter.loan_id, loan.id);
      assert.equal(Number(qardAfter.amount), 20.00);
    },
  },
  {
    name: '8. Grants: anon and authenticated cannot call repair_legacy_loan_ledger, service_role can',
    fn: async (db) => {
      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select public.repair_legacy_loan_ledger()`),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select public.repair_legacy_loan_ledger()`),
          'permission denied'
        )
      );

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );
      assert.ok(res);
    },
  },
  {
    name: '9. Broken legacy loan (missing fee row) is skipped and reported; valid loan is repaired',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      const tNormal = new Date(Date.now() - 60000);
      const tBroken = new Date(Date.now() - 20000);

      // 1. Normal legacy loan (RM50, net disbursement RM44.50, service fee 3.00, processing fee 2.50)
      const normalLoan = (await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 50.00, 'normal loan', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, tNormal.toISOString()]
      )).rows[0];

      const normalQard = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 44.50, 'Qard approved: normal loan', $2, null)
         returning id`,
        [kid.id, tNormal.toISOString()]
      )).rows[0];

      const normalFee1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)
         returning id`,
        [kid.id, tNormal.toISOString()]
      )).rows[0];

      const normalFee2 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 2.50, 'Loan processing fee', $2, null)
         returning id`,
        [kid.id, tNormal.toISOString()]
      )).rows[0];

      // 2. Broken legacy loan (RM80, net disbursement RM74.50, service fee 3.00, BUT processing fee row is missing!)
      const brokenLoan = (await db.query(
        `insert into public.loans (kid_id, amount, reason, status, created_at, due_date)
         values ($1, 80.00, 'broken loan', 'active', $2, ($2::timestamptz + interval '14 days')::date)
         returning id`,
        [kid.id, tBroken.toISOString()]
      )).rows[0];

      const brokenQard = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'QARD', 74.50, 'Qard approved: broken loan', $2, null)
         returning id`,
        [kid.id, tBroken.toISOString()]
      )).rows[0];

      const brokenFee1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at, loan_id)
         values ($1, 'WITHDRAWAL', 3.00, 'Loan service fee', $2, null)
         returning id`,
        [kid.id, tBroken.toISOString()]
      )).rows[0];

      // Snapshot the broken loan rows before repair
      const brokenQardBefore = (await db.query(`select * from public.transactions where id = $1`, [brokenQard.id])).rows[0];
      const brokenFee1Before = (await db.query(`select * from public.transactions where id = $1`, [brokenFee1.id])).rows[0];

      // First run: does not throw, repairs normal loan and records broken loan as inconsistent
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res.repaired, 1);
      assert.equal(res.inconsistent, 1);
      assert.ok(Array.isArray(res.inconsistent_tx_ids));
      assert.ok(res.inconsistent_tx_ids.includes(brokenQard.id));

      // Normal loan repaired
      const normalQardAfter = (await db.query(`select * from public.transactions where id = $1`, [normalQard.id])).rows[0];
      assert.equal(Number(normalQardAfter.amount), 50.00);
      assert.equal(normalQardAfter.loan_id, normalLoan.id);

      const normalFee1After = (await db.query(`select * from public.transactions where id = $1`, [normalFee1.id])).rows[0];
      assert.equal(normalFee1After.type, 'FEE');
      assert.equal(normalFee1After.loan_id, normalLoan.id);

      const normalFee2After = (await db.query(`select * from public.transactions where id = $1`, [normalFee2.id])).rows[0];
      assert.equal(normalFee2After.type, 'FEE');
      assert.equal(normalFee2After.loan_id, normalLoan.id);

      // Broken loan rows byte-for-byte unchanged
      const brokenQardAfter = (await db.query(`select * from public.transactions where id = $1`, [brokenQard.id])).rows[0];
      const brokenFee1After = (await db.query(`select * from public.transactions where id = $1`, [brokenFee1.id])).rows[0];
      assert.deepEqual(brokenQardAfter, brokenQardBefore);
      assert.deepEqual(brokenFee1After, brokenFee1Before);

      // Second run: broken loan still untouched and reported again
      const res2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.repair_legacy_loan_ledger() as res`)).rows[0].res
      );

      assert.equal(res2.repaired, 0);
      assert.equal(res2.inconsistent, 1);
      assert.ok(res2.inconsistent_tx_ids.includes(brokenQard.id));

      const brokenQardAfter2 = (await db.query(`select * from public.transactions where id = $1`, [brokenQard.id])).rows[0];
      const brokenFee1After2 = (await db.query(`select * from public.transactions where id = $1`, [brokenFee1.id])).rows[0];
      assert.deepEqual(brokenQardAfter2, brokenQardBefore);
      assert.deepEqual(brokenFee1After2, brokenFee1Before);
    },
  },
];
