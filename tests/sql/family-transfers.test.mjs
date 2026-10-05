import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Kid -> parent: balance drops, TRANSFER_OUT row, parent and kid notifications, ledger invariant',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50, comfort_name: 'Siddiq' });

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_send_to_parent($1, 5.00, null, 'Mama') as data`,
          [kid.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 45.00);

      const kidRow = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 45.00);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, 'TRANSFER_OUT');
      assert.equal(Number(txs[0].amount), 5.00);
      assert.equal(txs[0].label, 'Sent to Mama');

      // Ledger invariant
      assert.equal(50 - Number(txs[0].amount), Number(kidRow.balance));

      // Kid notification
      const kidNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kidNotes.length, 1);
      assert.equal(kidNotes[0].kind, 'TRANSFER');
      assert.equal(kidNotes[0].message, 'You sent RM5.00 to Mama.');
      assert.equal(kidNotes[0].link, '/kid/history');

      // Parent notification
      const parentNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(parentNotes.length, 1);
      assert.equal(parentNotes[0].kind, 'TRANSFER');
      assert.equal(parentNotes[0].message, 'Siddiq sent you RM5.00');
      assert.equal(parentNotes[0].link, '/parent');
    },
  },
  {
    name: '2. Kid -> sibling: instant transfer, both balances update, ledger invariant, 3 notifications, no approval',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const sender = await seedKid(db, parentId, { balance: 40, comfort_name: 'Siddiq' });
      const recipient = await seedKid(db, parentId, { balance: 20, comfort_name: 'Aisyah' });

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_send_to_sibling($1, $2, 5.00, 'Lunch') as data`,
          [sender.id, recipient.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 35.00);
      assert.equal(res.toKidId, recipient.id);
      assert.equal(Number(res.amount), 5.00);

      // Balances update at once
      const sRow = (await db.query(`select balance from public.kids where id = $1`, [sender.id])).rows[0];
      const rRow = (await db.query(`select balance from public.kids where id = $1`, [recipient.id])).rows[0];
      assert.equal(Number(sRow.balance), 35.00);
      assert.equal(Number(rRow.balance), 25.00);

      // Verify transactions
      const sTx = (await db.query(`select * from public.transactions where kid_id = $1`, [sender.id])).rows;
      assert.equal(sTx.length, 1);
      assert.equal(sTx[0].type, 'TRANSFER_OUT');
      assert.equal(Number(sTx[0].amount), 5.00);
      assert.equal(sTx[0].label, 'Sent to Aisyah: Lunch');

      const rTx = (await db.query(`select * from public.transactions where kid_id = $1`, [recipient.id])).rows;
      assert.equal(rTx.length, 1);
      assert.equal(rTx[0].type, 'TRANSFER_IN');
      assert.equal(Number(rTx[0].amount), 5.00);
      assert.equal(rTx[0].label, 'From Siddiq');

      // Ledger invariant
      assert.equal(40 - 5, Number(sRow.balance));
      assert.equal(20 + 5, Number(rRow.balance));

      // No approval row is created
      const approvalsCount = (await db.query(`select count(*) as c from public.approvals where kid_id in ($1, $2)`, [sender.id, recipient.id])).rows[0].c;
      assert.equal(Number(approvalsCount), 0);

      // Three notifications: 2 for kids, 1 for parent
      const sNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [sender.id])).rows;
      assert.equal(sNotes.length, 1);
      assert.equal(sNotes[0].message, 'You sent RM5.00 to Aisyah.');
      assert.equal(sNotes[0].link, '/kid/history');

      const rNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [recipient.id])).rows;
      assert.equal(rNotes.length, 1);
      assert.equal(rNotes[0].message, 'Siddiq sent you RM5.00.');
      assert.equal(rNotes[0].link, '/kid/history');

      const pNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(pNotes.length, 1);
      assert.equal(pNotes[0].message, 'Siddiq sent RM5.00 to Aisyah.');
      assert.equal(pNotes[0].link, '/parent');
    },
  },
  {
    name: '3. Legacy pending TRANSFER approval: can still be approved through resolve_approval',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const sender = await seedKid(db, parentId, { balance: 40, comfort_name: 'Siddiq' });
      const recipient = await seedKid(db, parentId, { balance: 20, comfort_name: 'Aisyah' });

      const approvalId = (await db.query(`
        insert into public.approvals (kid_id, to_kid_id, kind, amount, reason, status)
        values ($1, $2, 'TRANSFER', 5.00, 'Lunch', 'pending')
        returning id
      `, [sender.id, recipient.id])).rows[0].id;

      // Approve
      await asRole(db, 'service_role', async () =>
        db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId])
      );

      const sRow = (await db.query(`select balance from public.kids where id = $1`, [sender.id])).rows[0];
      const rRow = (await db.query(`select balance from public.kids where id = $1`, [recipient.id])).rows[0];
      assert.equal(Number(sRow.balance), 35.00);
      assert.equal(Number(rRow.balance), 25.00);

      // Verify transactions
      const sTx = (await db.query(`select * from public.transactions where kid_id = $1`, [sender.id])).rows;
      assert.equal(sTx.length, 1);
      assert.equal(sTx[0].type, 'TRANSFER_OUT');
      assert.equal(Number(sTx[0].amount), 5.00);
      assert.equal(sTx[0].label, 'Sent to Aisyah: Lunch');

      const rTx = (await db.query(`select * from public.transactions where kid_id = $1`, [recipient.id])).rows;
      assert.equal(rTx.length, 1);
      assert.equal(rTx[0].type, 'TRANSFER_IN');
      assert.equal(Number(rTx[0].amount), 5.00);
      assert.equal(rTx[0].label, 'From Siddiq');

      // Ledger invariant
      assert.equal(40 - 5, Number(sRow.balance));
      assert.equal(20 + 5, Number(rRow.balance));

      // 2 kid notifications
      const sNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [sender.id])).rows;
      assert.equal(sNotes.length, 1);
      assert.equal(sNotes[0].message, 'Your RM5.00 to Aisyah was approved and sent.');

      const rNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [recipient.id])).rows;
      assert.equal(rNotes.length, 1);
      assert.equal(rNotes[0].message, 'Siddiq sent you RM5.00.');

      // Second approve raises already_resolved
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId]),
          'already_resolved'
        )
      );
    },
  },
  {
    name: '4. Legacy pending TRANSFER approval: can still be declined through resolve_approval',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const sender = await seedKid(db, parentId, { balance: 40, comfort_name: 'Siddiq' });
      const recipient = await seedKid(db, parentId, { balance: 20, comfort_name: 'Aisyah' });

      const approvalId = (await db.query(`
        insert into public.approvals (kid_id, to_kid_id, kind, amount, reason, status)
        values ($1, $2, 'TRANSFER', 5.00, 'Toy', 'pending')
        returning id
      `, [sender.id, recipient.id])).rows[0].id;

      // Decline
      await asRole(db, 'service_role', async () =>
        db.query(`select resolve_approval($1, $2, false)`, [approvalId, parentId])
      );

      const sRow = (await db.query(`select balance from public.kids where id = $1`, [sender.id])).rows[0];
      const rRow = (await db.query(`select balance from public.kids where id = $1`, [recipient.id])).rows[0];
      assert.equal(Number(sRow.balance), 40.00);
      assert.equal(Number(rRow.balance), 20.00);

      const txs = (await db.query(`select * from public.transactions where kid_id in ($1, $2)`, [sender.id, recipient.id])).rows;
      assert.equal(txs.length, 0);

      const sNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [sender.id])).rows;
      assert.equal(sNotes.length, 1);
      assert.equal(sNotes[0].message, 'Your RM5.00 to Aisyah was not approved.');
    },
  },
  {
    name: '5. Rejected validation: self, outside family, amount bounds, balance, note length, daily cap',
    fn: async (db) => {
      const parentA = await seedParent(db);
      const parentB = await seedParent(db);
      const kidA = await seedKid(db, parentA, { balance: 100, comfort_name: 'Kid A' });
      const kidSibling = await seedKid(db, parentA, { balance: 30, comfort_name: 'Sibling' });
      const kidOther = await seedKid(db, parentB, { balance: 30, comfort_name: 'Kid B' });

      // Self transfer
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_sibling($1, $1, 5.00, null)`, [kidA.id]),
          'self_transfer'
        )
      );

      // Outside family
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_sibling($1, $2, 5.00, null)`, [kidA.id, kidOther.id]),
          'not_family'
        )
      );

      // Invalid amount: 0, negative, fractional cent
      for (const badAmt of [0, -1, 1.005]) {
        await asRole(db, 'service_role', () =>
          expectError(
            db.query(`select kid_send_to_sibling($1, $2, $3, null)`, [kidA.id, kidSibling.id, badAmt]),
            'invalid_amount'
          )
        );
      }

      // Insufficient balance
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_sibling($1, $2, 105.00, null)`, [kidA.id, kidSibling.id]),
          'insufficient_balance'
        )
      );

      // Invalid note (>40 chars)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_sibling($1, $2, 5.00, $3)`, [
            kidA.id,
            kidSibling.id,
            'a'.repeat(41),
          ]),
          'invalid_note'
        )
      );

      // Daily limit: 30 succeeds, then 25 exceeds 50 cap
      await asRole(db, 'service_role', () =>
        db.query(`select kid_send_to_sibling($1, $2, 30.00, 'Part 1')`, [kidA.id, kidSibling.id])
      );

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_sibling($1, $2, 25.00, 'Part 2')`, [kidA.id, kidSibling.id]),
          'transfer_limit_exceeded'
        )
      );

      // Send to parent also respects daily cap
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_send_to_parent($1, 25.00, 'To Mom', 'Mama')`, [kidA.id]),
          'transfer_limit_exceeded'
        )
      );
    },
  },
  {
    name: '6. Approval after balance dropped: insufficient_balance, nothing moves, request stays pending',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const sender = await seedKid(db, parentId, { balance: 20, comfort_name: 'Siddiq' });
      const recipient = await seedKid(db, parentId, { balance: 10, comfort_name: 'Aisyah' });

      const approvalId = (await db.query(`
        insert into public.approvals (kid_id, to_kid_id, kind, amount, reason, status)
        values ($1, $2, 'TRANSFER', 20.00, 'Project', 'pending')
        returning id
      `, [sender.id, recipient.id])).rows[0].id;

      // Sender spends money out-of-band (e.g. withdrawal or donation)
      await db.query(`update public.kids set balance = 5.00 where id = $1`, [sender.id]);

      // Parent tries to approve
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId]),
          'insufficient_balance'
        )
      );

      // Balances untouched
      const sRow = (await db.query(`select balance from public.kids where id = $1`, [sender.id])).rows[0];
      const rRow = (await db.query(`select balance from public.kids where id = $1`, [recipient.id])).rows[0];
      assert.equal(Number(sRow.balance), 5.00);
      assert.equal(Number(rRow.balance), 10.00);

      // Approval stays pending
      const ap = (await db.query(`select status from public.approvals where id = $1`, [approvalId])).rows[0];
      assert.equal(ap.status, 'pending');
    },
  },
  {
    name: '7. Parent -> kid: immediate transfer, limits, wrong family not_found',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const otherParentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10, comfort_name: 'Aisyah' });
      const otherKid = await seedKid(db, otherParentId, { balance: 10, comfort_name: 'Other' });

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select parent_send_to_kid($1, $2, 20.00, 'Allowance', 'Mama') as data`,
          [parentId, kid.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 30.00);

      const kidRow = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 30.00);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, 'TRANSFER_IN');
      assert.equal(Number(txs[0].amount), 20.00);
      assert.equal(txs[0].label, 'From Mama: Allowance');

      const kNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kNotes.length, 1);
      assert.equal(kNotes[0].message, 'Mama sent you RM20.00.');

      // Another parent's kid -> not_found
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_send_to_kid($1, $2, 20.00, null, 'Mama')`, [parentId, otherKid.id]),
          'not_found'
        )
      );

      // Amount bounds: 0, 1000.01
      for (const badAmt of [0, 1000.01]) {
        await asRole(db, 'service_role', () =>
          expectError(
            db.query(`select parent_send_to_kid($1, $2, $3, null, 'Mama')`, [parentId, kid.id, badAmt]),
            'invalid_amount'
          )
        );
      }
    },
  },
  {
    name: '8. Access control and foreign key constraints',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });

      // Anon cannot execute functions
      for (const role of ['anon', 'authenticated']) {
        await asRole(db, role, () =>
          expectError(
            db.query(`select kid_send_to_sibling($1, $1, 5.00, null)`, [kid.id]),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select kid_send_to_parent($1, 5.00, null)`, [kid.id]),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select parent_send_to_kid($1, $2, 5.00, null)`, [parentId, kid.id]),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select kid_transfer_out_today($1)`, [kid.id]),
            'permission denied'
          )
        );
      }

      // Check both foreign keys exist with expected names
      const fks = (await db.query(`
        select constraint_name
          from information_schema.table_constraints
         where table_name = 'approvals'
           and constraint_type = 'FOREIGN KEY'
      `)).rows.map((r) => r.constraint_name);

      assert.ok(fks.includes('approvals_kid_id_fkey'), 'approvals_kid_id_fkey must exist');
      assert.ok(fks.includes('approvals_to_kid_id_fkey'), 'approvals_to_kid_id_fkey must exist');
    },
  },
];
