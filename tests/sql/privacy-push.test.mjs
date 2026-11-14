import assert from 'node:assert/strict';
import { seedParent, seedKid } from './harness.mjs';

export const tests = [
  {
    name: '1. push_subscriptions has RLS enabled and export/delete RPCs are service_role only',
    async fn(db) {
      const rlsRow = (await db.query(
        `SELECT c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'push_subscriptions'`
      )).rows[0];
      assert.equal(rlsRow?.relrowsecurity, true);

      const privs = (await db.query(`
        SELECT
          has_function_privilege('anon', 'public.parent_export_family_data(uuid)', 'execute') AS anon_export,
          has_function_privilege('authenticated', 'public.parent_export_family_data(uuid)', 'execute') AS auth_export,
          has_function_privilege('service_role', 'public.parent_export_family_data(uuid)', 'execute') AS sr_export,
          has_function_privilege('anon', 'public.parent_delete_account_data(uuid)', 'execute') AS anon_delete,
          has_function_privilege('authenticated', 'public.parent_delete_account_data(uuid)', 'execute') AS auth_delete,
          has_function_privilege('service_role', 'public.parent_delete_account_data(uuid)', 'execute') AS sr_delete
      `)).rows[0];

      assert.equal(privs.anon_export, false);
      assert.equal(privs.auth_export, false);
      assert.equal(privs.sr_export, true);
      assert.equal(privs.anon_delete, false);
      assert.equal(privs.auth_delete, false);
      assert.equal(privs.sr_delete, true);
    },
  },
  {
    name: '2. Whole-family export returns all non-secret records and excludes PIN/push secrets',
    async fn(db) {
      const parentId = await seedParent(db);
      const kidA = (await seedKid(db, parentId, { name: 'Kid One', balance: 25.00 })).id;
      const kidB = (await seedKid(db, parentId, { name: 'Kid Two', balance: 15.00 })).id;

      await db.query(
        `INSERT INTO public.commander_pins (parent_id, pin_hash) VALUES ($1, '$2a$10$secret_pin_hash_value')`,
        [parentId]
      );
      await db.query(
        `INSERT INTO public.goals (kid_id, name, emoji, target, saved) VALUES ($1, 'Bike', '🚲', 100, 20)`,
        [kidA]
      );
      await db.query(
        `INSERT INTO public.transactions (kid_id, type, label, amount) VALUES ($1, 'DEPOSIT', 'Allowance', 10.00)`,
        [kidA]
      );
      await db.query(
        `SELECT public.parent_create_chore($1, $2, 'Tidy room', 4.00)`,
        [parentId, kidB]
      );
      await db.query(
        `INSERT INTO public.push_subscriptions (parent_id, kid_id, role, endpoint, p256dh, auth)
         VALUES ($1, NULL, 'parent', 'https://push.example/p1', 'secret-p256dh', 'secret-auth'),
                (NULL, $2, 'kid', 'https://push.example/k1', 'secret-p256dh-2', 'secret-auth-2')`,
        [parentId, kidA]
      );

      const exported = (await db.query(
        `SELECT public.parent_export_family_data($1) AS data`,
        [parentId]
      )).rows[0].data;

      assert.equal(exported.parent.id, parentId);
      assert.equal(exported.children.length, 2);
      assert.equal(exported.goals.length, 1);
      assert.equal(exported.transactions.length, 1);
      assert.equal(exported.chores.length, 1);
      assert.equal(exported.push_subscriptions_count, 2);
      assert.ok(typeof exported.retention_rule === 'string' && exported.retention_rule.length > 10);

      const serialized = JSON.stringify(exported);
      assert.equal(serialized.includes('secret_pin_hash_value'), false);
      assert.equal(serialized.includes('secret-p256dh'), false);
      assert.equal(serialized.includes('secret-auth'), false);
      assert.equal(serialized.includes('hashed_pin'), false);
    },
  },
  {
    name: '3. Full account deletion removes parent, kids, chores, goals, transactions, and push subscriptions without touching other families',
    async fn(db) {
      const parentA = await seedParent(db);
      const kidA = (await seedKid(db, parentA, { name: 'Alpha Kid', balance: 30.00 })).id;
      const parentB = await seedParent(db);
      const kidB = (await seedKid(db, parentB, { name: 'Beta Kid', balance: 40.00 })).id;

      await db.query(
        `INSERT INTO public.commander_pins (parent_id, pin_hash) VALUES ($1, '$2a$10$hashA')`,
        [parentA]
      );
      await db.query(
        `INSERT INTO public.goals (kid_id, name, emoji, target, saved) VALUES ($1, 'Book', '📘', 50, 10)`,
        [kidA]
      );
      await db.query(
        `INSERT INTO public.transactions (kid_id, type, label, amount) VALUES ($1, 'DEPOSIT', 'Gift', 10.00)`,
        [kidA]
      );
      await db.query(
        `SELECT public.parent_create_chore($1, $2, 'Sweep floor', 3.00)`,
        [parentA, kidA]
      );
      await db.query(
        `INSERT INTO public.push_subscriptions (parent_id, kid_id, role, endpoint, p256dh, auth)
         VALUES ($1, NULL, 'parent', 'https://push.example/del-p', 'k1', 'a1'),
                (NULL, $2, 'kid', 'https://push.example/del-k', 'k2', 'a2'),
                ($3, NULL, 'parent', 'https://push.example/keep-b', 'k3', 'a3')`,
        [parentA, kidA, parentB]
      );

      const del = (await db.query(
        `SELECT public.parent_delete_account_data($1) AS res`,
        [parentA]
      )).rows[0].res;

      assert.equal(del.deleted_parent_id, parentA);
      assert.equal(del.deleted_kids, 1);

      const remainingA = (await db.query(
        `SELECT
          (SELECT count(*)::int FROM public.profiles WHERE id = $1) AS profiles,
          (SELECT count(*)::int FROM public.kids WHERE parent_id = $1) AS kids,
          (SELECT count(*)::int FROM public.goals WHERE kid_id = $2) AS goals,
          (SELECT count(*)::int FROM public.transactions WHERE kid_id = $2) AS txs,
          (SELECT count(*)::int FROM public.chores WHERE parent_id = $1) AS chores,
          (SELECT count(*)::int FROM public.push_subscriptions WHERE parent_id = $1 OR kid_id = $2) AS push,
          (SELECT count(*)::int FROM public.commander_pins WHERE parent_id = $1) AS pins`,
        [parentA, kidA]
      )).rows[0];

      assert.deepEqual(remainingA, {
        profiles: 0,
        kids: 0,
        goals: 0,
        txs: 0,
        chores: 0,
        push: 0,
        pins: 0,
      });

      const remainingB = (await db.query(
        `SELECT
          (SELECT count(*)::int FROM public.profiles WHERE id = $1) AS profiles,
          (SELECT count(*)::int FROM public.kids WHERE id = $2) AS kids,
          (SELECT count(*)::int FROM public.push_subscriptions WHERE parent_id = $1) AS push`,
        [parentB, kidB]
      )).rows[0];

      assert.deepEqual(remainingB, { profiles: 1, kids: 1, push: 1 });
    },
  },
];
