import assert from 'node:assert/strict';
import { seedParent, seedKid } from './harness.mjs';

export const tests = [
  {
    name: '1. Happy path: parent creates chore, kid marks done, parent approves -> CHORE credit + both-way notifications',
    async fn(db) {
      const parentId = await seedParent(db);
      const kidId = (await seedKid(db, parentId, { balance: 10.00 })).id;

      const created = (await db.query(
        `SELECT public.parent_create_chore($1, $2, $3, $4) AS res`,
        [parentId, kidId, 'Fold laundry', 3.50]
      )).rows[0].res;

      assert.equal(created.status, 'OPEN');
      assert.equal(Number(created.amount), 3.50);

      const done = (await db.query(
        `SELECT public.kid_complete_chore($1, $2) AS res`,
        [kidId, created.id]
      )).rows[0].res;
      assert.equal(done.status, 'DONE');

      const approved = (await db.query(
        `SELECT public.parent_resolve_chore($1, $2, 'APPROVED') AS res`,
        [parentId, created.id]
      )).rows[0].res;
      assert.equal(approved.status, 'APPROVED');
      assert.equal(Number(approved.balance), 13.50);

      const txRows = (await db.query(
        `SELECT type, label, amount::numeric FROM public.transactions WHERE kid_id = $1`,
        [kidId]
      )).rows;
      assert.equal(txRows.length, 1);
      assert.equal(txRows[0].type, 'CHORE');
      assert.equal(txRows[0].label, 'Fold laundry');
      assert.equal(Number(txRows[0].amount), 3.50);

      const parentNotifs = (await db.query(
        `SELECT kind, message FROM public.notifications WHERE parent_id = $1 AND kind = 'CHORE'`,
        [parentId]
      )).rows;
      assert.equal(parentNotifs.length, 1);
      assert.match(parentNotifs[0].message, /Fold laundry/);

      const kidNotifs = (await db.query(
        `SELECT kind, message FROM public.kid_notifications WHERE kid_id = $1 AND kind = 'CHORE'`,
        [kidId]
      )).rows;
      assert.equal(kidNotifs.length, 2);
    },
  },
  {
    name: '2. Idempotency & declined: second resolve raises already_resolved and declined credits nothing',
    async fn(db) {
      const parentId = await seedParent(db);
      const kidId = (await seedKid(db, parentId, { balance: 20.00 })).id;

      const created = (await db.query(
        `SELECT public.parent_create_chore($1, $2, $3, $4) AS res`,
        [parentId, kidId, 'Water plants', 2.00]
      )).rows[0].res;

      await assert.rejects(
        () => db.query(`SELECT public.parent_resolve_chore($1, $2, 'APPROVED')`, [parentId, created.id]),
        /already_resolved/
      );

      await db.query(`SELECT public.kid_complete_chore($1, $2)`, [kidId, created.id]);

      await assert.rejects(
        () => db.query(`SELECT public.kid_complete_chore($1, $2)`, [kidId, created.id]),
        /already_resolved/
      );

      const declined = (await db.query(
        `SELECT public.parent_resolve_chore($1, $2, 'DECLINED') AS res`,
        [parentId, created.id]
      )).rows[0].res;
      assert.equal(declined.status, 'DECLINED');
      assert.equal(Number(declined.balance), 20.00);

      await assert.rejects(
        () => db.query(`SELECT public.parent_resolve_chore($1, $2, 'APPROVED')`, [parentId, created.id]),
        /already_resolved/
      );
    },
  },
  {
    name: '3. Validation & cross-family isolation',
    async fn(db) {
      const parentA = await seedParent(db);
      const parentB = await seedParent(db);
      const kidA = (await seedKid(db, parentA, { balance: 10.00 })).id;

      await assert.rejects(
        () => db.query(`SELECT public.parent_create_chore($1, $2, '   ', 5.00)`, [parentA, kidA]),
        /invalid_title/
      );
      await assert.rejects(
        () => db.query(`SELECT public.parent_create_chore($1, $2, 'Wash car', -5)`, [parentA, kidA]),
        /invalid_amount/
      );
      await assert.rejects(
        () => db.query(`SELECT public.parent_create_chore($1, $2, 'Wash car', 1.234)`, [parentA, kidA]),
        /invalid_amount/
      );
      await assert.rejects(
        () => db.query(`SELECT public.parent_create_chore($1, $2, 'Wash car', 5.00)`, [parentB, kidA]),
        /not_found/
      );
    },
  },
  {
    name: '4. Grants & RLS: anon and authenticated cannot call chore RPCs or write chores directly',
    async fn(db) {
      for (const role of ['anon', 'authenticated']) {
        const canCreate = (await db.query(
          `SELECT has_function_privilege($1, 'public.parent_create_chore(uuid, uuid, text, numeric)', 'execute') AS ok`,
          [role]
        )).rows[0].ok;
        const canComplete = (await db.query(
          `SELECT has_function_privilege($1, 'public.kid_complete_chore(uuid, uuid)', 'execute') AS ok`,
          [role]
        )).rows[0].ok;
        const canResolve = (await db.query(
          `SELECT has_function_privilege($1, 'public.parent_resolve_chore(uuid, uuid, text)', 'execute') AS ok`,
          [role]
        )).rows[0].ok;
        assert.equal(canCreate, false, role);
        assert.equal(canComplete, false, role);
        assert.equal(canResolve, false, role);
      }

      const rlsEnabled = (await db.query(
        `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chores'::regclass`
      )).rows[0].relrowsecurity;
      assert.equal(rlsEnabled, true);
    },
  },
];
