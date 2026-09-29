import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Audit scenario: approving a RM100 QARD gives wallet +99.00 and 2 linked rows (gross QARD + 1 fee)',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });
      const approvalRes = await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'QARD', 100.00, 'new bicycle (due 14d) :: SIG::data:image/png;base64,abc', 'pending')
         returning id`,
        [kid.id]
      );
      const approvalId = approvalRes.rows[0].id;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select resolve_approval($1, $2, true, '2026-10-12', 'new bicycle', 'sig_abc') as res`,
          [approvalId, parentId]
        )).rows[0].res
      );

      assert.equal(res.ok, true);
      assert.ok(res.loan_id, 'returns loan_id');

      // Balance changed by +99.00
      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 109.00);

      // Verify loan row created
      const loanRow = (await db.query(`select * from public.loans where id = $1`, [res.loan_id])).rows[0];
      assert.equal(loanRow.kid_id, kid.id);
      assert.equal(Number(loanRow.amount), 100.00);

      // Verify transactions
      const txRows = (await db.query(
        `select * from public.transactions where loan_id = $1 order by id`,
        [res.loan_id]
      )).rows;

      assert.equal(txRows.length, 2);

      const qardTx = txRows.find((t) => t.type === 'QARD');
      assert.ok(qardTx);
      assert.equal(Number(qardTx.amount), 100.00);
      assert.equal(qardTx.label, 'Qard approved: new bicycle');
      assert.equal(qardTx.loan_id, res.loan_id);

      const feeTxs = txRows.filter((t) => t.type === 'FEE');
      assert.equal(feeTxs.length, 1);

      const adminFee = feeTxs.find((t) => t.label === 'Loan admin fee');
      assert.ok(adminFee);
      assert.equal(Number(adminFee.amount), 1.00);
      assert.equal(adminFee.loan_id, res.loan_id);

      // Invariant: credits (QARD 100) minus debits (FEE 1.00) = 99.00 = balance change
      const credits = Number(qardTx.amount);
      const debits = Number(adminFee.amount);
      assert.equal(credits - debits, 99.00);
      assert.equal(Number(kidAfter.balance) - 10, credits - debits);
    },
  },
  {
    name: '2. RM10 loan: fee 1.00, balance change 9.00; legacy RM0.50 loan: fee 0.50, balance change 0',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 5 });

      // RM10 loan
      const ap10 = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'QARD', 10.00, 'small toy', 'pending')
         returning id`,
        [kid.id]
      )).rows[0].id;

      const res10 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select resolve_approval($1, $2, true, '2026-10-12', 'small toy', null) as res`,
          [ap10, parentId]
        )).rows[0].res
      );

      const kidAfter10 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter10.balance), 14.00); // +9.00

      const txs10 = (await db.query(
        `select * from public.transactions where loan_id = $1 order by id`,
        [res10.loan_id]
      )).rows;

      assert.equal(txs10.length, 2);
      assert.equal(Number(txs10.find((t) => t.type === 'QARD').amount), 10.00);
      assert.equal(Number(txs10.find((t) => t.label === 'Loan admin fee').amount), 1.00);

      // Legacy RM0.50 request
      const ap05 = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'QARD', 0.50, 'pencil', 'pending')
         returning id`,
        [kid.id]
      )).rows[0].id;

      const res05 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select resolve_approval($1, $2, true, '2026-10-12', 'pencil', null) as res`,
          [ap05, parentId]
        )).rows[0].res
      );

      const kidAfter05 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter05.balance), 14.00); // 14 + (0.50 - 0.50) = 14 (no change)

      const txs05 = (await db.query(
        `select * from public.transactions where loan_id = $1 order by id`,
        [res05.loan_id]
      )).rows;

      assert.equal(txs05.length, 2); // QARD + 1 fee
      assert.equal(Number(txs05.find((t) => t.type === 'QARD').amount), 0.50);
      assert.equal(Number(txs05.find((t) => t.label === 'Loan admin fee').amount), 0.50);
    },
  },
  {
    name: '3. Second approval of QARD raises already_resolved, loan and fee rows written once',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 0 });

      const apId = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'QARD', 50.00, 'book', 'pending')
         returning id`,
        [kid.id]
      )).rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(`select resolve_approval($1, $2, true, '2026-10-12', 'book', null)`, [apId, parentId])
      );

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_approval($1, $2, true, '2026-10-12', 'book', null)`, [apId, parentId]),
          'already_resolved'
        )
      );

      const loansCount = (await db.query(`select count(*) from public.loans where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(loansCount), 1);

      const txCount = (await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(txCount), 2);
    },
  },
  {
    name: '4. Backfill updates legacy QARD Loan repayment rows to QARD_REPAY and leaves others alone',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50 });

      const tx1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'QARD', 20.00, 'Loan repayment')
         returning id`,
        [kid.id]
      )).rows[0].id;

      const tx2 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'QARD', 50.00, 'Qard approved: bike')
         returning id`,
        [kid.id]
      )).rows[0].id;

      // Run backfill statement
      await db.query(
        `update public.transactions
         set type = 'QARD_REPAY'
         where type = 'QARD' and label = 'Loan repayment'`
      );

      const row1 = (await db.query(`select type from public.transactions where id = $1`, [tx1])).rows[0];
      assert.equal(row1.type, 'QARD_REPAY');

      const row2 = (await db.query(`select type from public.transactions where id = $1`, [tx2])).rows[0];
      assert.equal(row2.type, 'QARD');
    },
  },
];
