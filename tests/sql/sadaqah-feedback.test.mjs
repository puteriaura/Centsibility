import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. With a cause: label is Sadaqah to Orphan Relief, balance drops, notifications written, ledger invariant holds',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50, coins: 5, comfort_name: 'Adam' });

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_give_sadaqah($1, 10.00, 'Orphan Relief') as data`,
          [kid.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 40.00);
      assert.equal(Number(res.coins_awarded), 0);
      assert.equal(res.cause, 'Orphan Relief');

      const kidRow = (await db.query(`select balance, coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 40.00);
      assert.equal(Number(kidRow.coins), 5);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, 'SADAQAH');
      assert.equal(Number(txs[0].amount), 10.00);
      assert.equal(txs[0].label, 'Sadaqah to Orphan Relief');

      // Ledger invariant
      assert.equal(50 - Number(txs[0].amount), Number(kidRow.balance));

      // Kid notification
      const kidNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kidNotes.length, 1);
      assert.equal(kidNotes[0].kind, 'SADAQAH');
      assert.equal(kidNotes[0].message, 'You pledged RM10.00 to Orphan Relief.');
      assert.equal(kidNotes[0].link, '/kid/sadaqah');
      assert.equal(kidNotes[0].read, false);

      // Parent notification
      const parentNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(parentNotes.length, 1);
      assert.equal(parentNotes[0].kid_id, kid.id);
      assert.equal(parentNotes[0].kind, 'SADAQAH');
      assert.equal(parentNotes[0].message, 'Adam pledged RM10.00 sadaqah to Orphan Relief. Please pass this pledge on to the cause.');
      assert.equal(parentNotes[0].link, '/parent');
    },
  },
  {
    name: '2. The old 2-argument call still works and writes Sadaqah given',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 30, coins: 0, name: 'Siddiq' });

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_give_sadaqah($1, 5.00) as data`,
          [kid.id]
        )).rows[0].data
      );

      assert.equal(Number(res.balance), 25.00);
      assert.equal(Number(res.coins_awarded), 0);
      assert.equal(res.cause, null);

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].label, 'Sadaqah given');

      const kidNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kidNotes.length, 1);
      assert.equal(kidNotes[0].message, 'You pledged RM5.00.');

      const parentNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(parentNotes.length, 1);
      assert.equal(parentNotes[0].kid_id, kid.id);
      assert.equal(parentNotes[0].message, 'Siddiq pledged RM5.00 sadaqah. Please pass this pledge on to the cause.');
    },
  },
  {
    name: '3. Invalid cause: blank or >40 characters raises invalid_cause, nothing written',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 30 });

      // Blank string
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 5.00, '')`, [kid.id]),
          'invalid_cause'
        )
      );

      // Whitespace string
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 5.00, '   ')`, [kid.id]),
          'invalid_cause'
        )
      );

      // > 40 chars
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 5.00, $2)`, [kid.id, 'a'.repeat(41)]),
          'invalid_cause'
        )
      );

      // Nothing written
      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 0);
      const kidNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kidNotes.length, 0);
      const parentNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(parentNotes.length, 0);

      const kidRow = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.balance), 30);
    },
  },
  {
    name: '4. Not enough balance: insufficient_balance and no notification rows',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 5 });

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 10.00, 'Local Masjid')`, [kid.id]),
          'insufficient_balance'
        )
      );

      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 0);
      const kidNotes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(kidNotes.length, 0);
      const parentNotes = (await db.query(`select * from public.notifications where parent_id = $1`, [parentId])).rows;
      assert.equal(parentNotes.length, 0);
    },
  },
  {
    name: '5. Access: anon and authenticated cannot access kid_notifications or execute kid_give_sadaqah',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });

      // Anon
      await asRole(db, 'anon', async () => {
        await expectError(db.query('select * from public.kid_notifications'), 'permission denied');
        await expectError(
          db.query(`insert into public.kid_notifications (kid_id, kind, message) values ($1, 'TEST', 'msg')`, [kid.id]),
          'permission denied'
        );
        await expectError(db.query(`select kid_give_sadaqah($1, 5.00, 'Cause')`, [kid.id]), 'permission denied');
        await expectError(db.query(`select kid_give_sadaqah($1, 5.00)`, [kid.id]), 'permission denied');
      });

      // Authenticated
      await asRole(db, 'authenticated', async () => {
        await expectError(db.query('select * from public.kid_notifications'), 'permission denied');
        await expectError(
          db.query(`insert into public.kid_notifications (kid_id, kind, message) values ($1, 'TEST', 'msg')`, [kid.id]),
          'permission denied'
        );
        await expectError(db.query(`select kid_give_sadaqah($1, 5.00, 'Cause')`, [kid.id]), 'permission denied');
        await expectError(db.query(`select kid_give_sadaqah($1, 5.00)`, [kid.id]), 'permission denied');
      });
    },
  },
  {
    name: '6. Cleanup: deleting a kid removes its kid_notifications rows via cascade',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });

      await asRole(db, 'service_role', async () => {
        await db.query(`select kid_give_sadaqah($1, 5.00, 'Clean Water Wells')`, [kid.id]);
      });

      const before = (await db.query(`select count(*) from public.kid_notifications where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(before), 1);

      await asRole(db, 'service_role', async () => {
        await db.query(`select delete_kid($1, $2)`, [kid.id, parentId]);
      });

      const after = (await db.query(`select count(*) from public.kid_notifications where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(after), 0);
    },
  },
];
