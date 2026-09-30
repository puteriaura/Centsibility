import assert from 'node:assert/strict';
import { seedParent, seedKid } from './harness.mjs';

// keep in sync with supabase/functions/kid-finance/index.ts handlePennyChat
export const tests = [
  {
    name: '1. Penny context queries match schema column names exactly',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      // Query 1: goals (name, target, saved)
      const goalsRes = await db.query(
        `select name, target, saved from public.goals where kid_id = $1 limit 10`,
        [kid.id]
      );
      assert.ok(Array.isArray(goalsRes.rows));

      // Query 2: loans (amount, repaid, status, due_date)
      const loansRes = await db.query(
        `select amount, repaid, status, due_date from public.loans where kid_id = $1 limit 5`,
        [kid.id]
      );
      assert.ok(Array.isArray(loansRes.rows));

      // Query 3: rewards (name, cost, status)
      const rewardsRes = await db.query(
        `select name, cost, status from public.rewards where kid_id = $1 limit 5`,
        [kid.id]
      );
      assert.ok(Array.isArray(rewardsRes.rows));

      // Query 4: transactions (type, amount, label, created_at)
      const txsRes = await db.query(
        `select type, amount, label, created_at from public.transactions where kid_id = $1 order by created_at desc limit 20`,
        [kid.id]
      );
      assert.ok(Array.isArray(txsRes.rows));
    },
  },
];
