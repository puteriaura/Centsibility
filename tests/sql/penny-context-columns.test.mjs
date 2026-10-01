import assert from 'node:assert/strict';
import { seedParent, seedKid } from './harness.mjs';

// keep in sync with supabase/functions/kid-finance/index.ts and parent-finance/index.ts handlePennyChat
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

      // Query 4: transactions (type, amount, label, created_at) with 35-day filter & 300 limit
      const txsRes = await db.query(
        `select type, amount, label, created_at
           from public.transactions
          where kid_id = $1
            and created_at >= (now() - interval '35 days')
          order by created_at desc
          limit 300`,
        [kid.id]
      );
      assert.ok(Array.isArray(txsRes.rows));

      // Query 5: kids columns for coach context
      const kidsRes = await db.query(
        `select id, parent_id, name, comfort_name, balance, invest_balance, coins, streak, birth_date, birth_year, age_group_override
           from public.kids
          where id = $1`,
        [kid.id]
      );
      assert.equal(kidsRes.rows.length, 1);

      // Query 6: quest completions & quests join
      const completionsRes = await db.query(
        `select qc.quest_id, qc.completed_at, qc.points_awarded, qc.best_correct, q.title, q.age_group
           from public.quest_completions qc
           join public.quests q on q.id = qc.quest_id
          where qc.kid_id = $1
          order by qc.completed_at desc
          limit 5`,
        [kid.id]
      );
      assert.ok(Array.isArray(completionsRes.rows));

      // Query 7: approvals for pending requests (parent context)
      const approvalsRes = await db.query(
        `select id, kid_id, kind, amount, reason, status
           from public.approvals
          where kid_id = $1 and status = 'pending'`,
        [kid.id]
      );
      assert.ok(Array.isArray(approvalsRes.rows));

      // Query 8: profiles quota columns (parent context)
      const profilesRes = await db.query(
        `select id, penny_ai_date, penny_ai_count
           from public.profiles
          where id = $1`,
        [parentId]
      );
      assert.equal(profilesRes.rows.length, 1);

      // Query 9: RPC kid_age_group
      const ageGroupRes = await db.query(
        `select kid_age_group($1) as age_group`,
        [kid.id]
      );
      assert.ok(ageGroupRes.rows[0].age_group);

      // Query 10: RPC kid_quest_board
      const questBoardRes = await db.query(
        `select kid_quest_board($1) as board`,
        [kid.id]
      );
      assert.ok(questBoardRes.rows[0].board);
    },
  },
];
