import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. kid_investment_open validates inputs and limits',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      // invalid_amount
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 5, 0.50)`, [kid.id])
        ),
        'invalid_amount'
      );
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 5, 5.555)`, [kid.id])
        ),
        'invalid_amount'
      );

      // invalid_option: bad tier
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'crypto', 'minute', 5, 5.00)`, [kid.id])
        ),
        'invalid_option'
      );

      // invalid_option: minute amount > 10.00
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 5, 15.00)`, [kid.id])
        ),
        'invalid_option'
      );

      // invalid_option: minute lock not in (5, 10, 15)
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 7, 5.00)`, [kid.id])
        ),
        'invalid_option'
      );

      // invalid_option: null tier, frequency, or lock_ticks
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, null, 'minute', 5, 5.00)`, [kid.id])
        ),
        'invalid_option'
      );
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', null, 5, 5.00)`, [kid.id])
        ),
        'invalid_option'
      );
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', null, 5.00)`, [kid.id])
        ),
        'invalid_option'
      );

      // insufficient_balance
      const poorKid = await seedKid(db, parentId, { balance: 2 });
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 5, 5.00)`, [poorKid.id])
        ),
        'insufficient_balance'
      );
    },
  },
  {
    name: '2. minute fund rules: 1 open at a time, max 3 a day, client_request_id retry-safe',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      const reqId = 'a0000000-0000-0000-0000-000000000001';

      // First open
      const res1 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_investment_open($1, 'low', 'minute', 5, 5.00, $2::uuid) as data`,
          [kid.id, reqId]
        )).rows[0].data
      );
      assert.equal(Number(res1.principal), 5.00);
      assert.equal(res1.status, 'active');

      const bal1 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(bal1), 95.00);

      // Retry with same client_request_id returns existing and does NOT debit again
      const resRetry = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_investment_open($1, 'low', 'minute', 5, 5.00, $2::uuid) as data`,
          [kid.id, reqId]
        )).rows[0].data
      );
      assert.equal(resRetry.id, res1.id);
      const balRetry = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(balRetry), 95.00);

      // Second minute open fails with limit_reached (1 open at a time)
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'medium', 'minute', 5, 5.00)`, [kid.id])
        ),
        'limit_reached'
      );

      // Early close minute fund #1
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid)`, [kid.id, res1.id])
      );

      // Open minute fund #2
      const res2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_investment_open($1, 'low', 'minute', 5, 5.00) as data`, [kid.id])).rows[0].data
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid)`, [kid.id, res2.id])
      );

      // Open minute fund #3
      const res3 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_investment_open($1, 'low', 'minute', 5, 5.00) as data`, [kid.id])).rows[0].data
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid)`, [kid.id, res3.id])
      );

      // 4th minute fund today fails with limit_reached
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'minute', 5, 5.00)`, [kid.id])
        ),
        'limit_reached'
      );
    },
  },
  {
    name: '3. Max 5 active funds limit',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 200 });

      // Open 1 daily + 4 weekly = 5
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'day', 3, 5.00)`, [kid.id])
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'medium', 'week', 2, 5.00)`, [kid.id])
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'medium', 'week', 4, 5.00)`, [kid.id])
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'high', 'week', 8, 5.00)`, [kid.id])
      );
      await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'week', 2, 5.00)`, [kid.id])
      );

      // 6th fund fails with limit_reached
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_open($1, 'low', 'week', 2, 5.00)`, [kid.id])
        ),
        'limit_reached'
      );
    },
  },
  {
    name: '4. Deterministic path and speed schedules',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      // Create a minute fund with 5 ticks
      const invMin = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'minute', 5, 10.00) as data`, [kid.id])
      )).rows[0].data;

      // Set created_at to 3 minutes 30 seconds ago
      await db.query(
        `update public.investments set created_at = now() - interval '3 minutes 30 seconds' where id = $1`,
        [invMin.id]
      );

      const path1 = (await db.query(`select * from investment_fund_path($1, now())`, [invMin.id])).rows;
      assert.equal(path1.length, 3);
      assert.ok(Number(path1[2].value) > 10.00);

      // Second read at exact same time is identical
      const path2 = (await db.query(`select * from investment_fund_path($1, now())`, [invMin.id])).rows;
      assert.deepEqual(path1, path2);

      // Create daily fund with 3 ticks, set created_at to 2 days 1 hour ago
      const invDay = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'day', 3, 20.00) as data`, [kid.id])
      )).rows[0].data;
      await db.query(
        `update public.investments set created_at = now() - interval '2 days 1 hour' where id = $1`,
        [invDay.id]
      );
      const pathDay = (await db.query(`select * from investment_fund_path($1, now())`, [invDay.id])).rows;
      assert.equal(pathDay.length, 2);

      // Create weekly fund with 2 ticks, set created_at to 8 days ago
      const invWeek = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'medium', 'week', 2, 20.00) as data`, [kid.id])
      )).rows[0].data;
      await db.query(
        `update public.investments set created_at = now() - interval '8 days' where id = $1`,
        [invWeek.id]
      );
      const pathWeek = (await db.query(`select * from investment_fund_path($1, now())`, [invWeek.id])).rows;
      assert.equal(pathWeek.length, 1);

      // Fund past lock has exactly lock_ticks (not more)
      await db.query(
        `update public.investments set created_at = now() - interval '30 minutes' where id = $1`,
        [invMin.id]
      );
      const pathPast = (await db.query(`select * from investment_fund_path($1, now())`, [invMin.id])).rows;
      assert.equal(pathPast.length, 5);
    },
  },
  {
    name: '5. High tier path never dips below principal',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      const invHigh = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'high', 'day', 14, 50.00) as data`, [kid.id])
      )).rows[0].data;

      // Set to 15 days ago so all 14 ticks run
      await db.query(
        `update public.investments set created_at = now() - interval '15 days' where id = $1`,
        [invHigh.id]
      );

      const path = (await db.query(`select * from investment_fund_path($1, now())`, [invHigh.id])).rows;
      assert.equal(path.length, 14);
      for (const pt of path) {
        assert.ok(Number(pt.value) >= 50.00, `Tick ${pt.tick} value ${pt.value} dropped below principal 50.00`);
      }
    },
  },
  {
    name: '6. Settlement: pays once, writes INVEST_OUT, INVEST_GAIN, notification, ledger invariant holds',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50 });

      const inv = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'minute', 5, 10.00) as data`, [kid.id])
      )).rows[0].data;

      // Balance is now 40
      const balAfterOpen = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(balAfterOpen), 40.00);

      // Fast forward past maturity
      await db.query(
        `update public.investments set created_at = now() - interval '6 minutes' where id = $1`,
        [inv.id]
      );

      // Settle
      const settle1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investments_settle($1) as data`, [kid.id])
      )).rows[0].data;

      assert.ok(Number(settle1.paid) >= 10.00);

      // Second settle pays 0
      const settle2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investments_settle($1) as data`, [kid.id])
      )).rows[0].data;
      assert.equal(Number(settle2.paid), 0);

      // Check investment status
      const invRow = (await db.query(`select * from public.investments where id = $1`, [inv.id])).rows[0];
      assert.equal(invRow.status, 'closed');
      assert.equal(invRow.close_reason, 'matured');
      assert.equal(Number(invRow.payout), Number(settle1.paid));

      // Check transactions
      const txs = (await db.query(`select * from public.transactions where kid_id = $1 order by created_at asc`, [kid.id])).rows;
      assert.ok(txs.some((t) => t.type === 'INVEST_IN' && Number(t.amount) === 10.00));
      assert.ok(txs.some((t) => t.type === 'INVEST_OUT' && Number(t.amount) === Number(settle1.paid)));
      assert.ok(txs.some((t) => t.type === 'INVEST_GAIN'));

      // Invariant: initial (50) - INVEST_IN (10) + INVEST_OUT (payout) = current balance
      const currentBal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(currentBal).toFixed(2), (40.00 + Number(settle1.paid)).toFixed(2));

      // Notification
      const notifs = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.ok(notifs.length >= 1);
      assert.ok(notifs[0].message.includes('back in your spending money'));
    },
  },
  {
    name: '7. Early close: refunds principal, no gain row, already_resolved on second call',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50 });

      const inv = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_open($1, 'low', 'day', 7, 20.00) as data`, [kid.id])
      )).rows[0].data;

      // Close early
      const closeRes = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid) as data`, [kid.id, inv.id])
      )).rows[0].data;

      assert.equal(Number(closeRes.payout), 20.00);

      // Balance back to 50
      const currentBal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(currentBal), 50.00);

      // Second close fails with already_resolved
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_close($1, $2::uuid)`, [kid.id, inv.id])
        ),
        'already_resolved'
      );
    },
  },
  {
    name: '8. Growth Tabung migration preserves total balances and converts to weekly fund',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 25, invest_balance: 35, risk_appetite: 'high' });

      // Run migration block
      await db.query(`
        do $$
        declare
          k record;
          v_tier text;
          v_seed text;
        begin
          for k in select id, invest_balance, risk_appetite from public.kids where id = '${kid.id}' and invest_balance > 0 loop
            v_tier := case k.risk_appetite
              when 'very_low' then 'low'
              when 'low' then 'low'
              when 'medium' then 'medium'
              when 'high' then 'high'
              when 'very_high' then 'high'
              else 'medium'
            end;
            v_seed := md5(gen_random_uuid()::text || clock_timestamp()::text);
            insert into public.investments (
              kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed
            ) values (
              k.id, 'fund', 'Moved from Growth Tabung', round(k.invest_balance, 2), 'active',
              v_tier, 'week', 4, v_seed
            );
            update public.kids set invest_balance = 0 where id = k.id;
          end loop;
        end $$;
      `);

      const kidRow = (await db.query(`select * from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidRow.invest_balance), 0);
      assert.equal(Number(kidRow.balance), 25);

      const invs = (await db.query(`select * from public.investments where kid_id = $1`, [kid.id])).rows;
      assert.equal(invs.length, 1);
      assert.equal(invs[0].label, 'Moved from Growth Tabung');
      assert.equal(Number(invs[0].principal), 35.00);
      assert.equal(invs[0].tier, 'high');
      assert.equal(invs[0].frequency, 'week');
      assert.equal(invs[0].lock_ticks, 4);

      // Can be taken out early at any time
      const earlyRes = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid) as data`, [kid.id, invs[0].id])
      )).rows[0].data;
      assert.equal(Number(earlyRes.payout), 35.00);

      const finalBal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(finalBal), 60.00);
    },
  },
  {
    name: '9. Quests no longer mention Growth Tabung',
    fn: async (db) => {
      const qMatches = (await db.query(
        `select * from public.quests where summary like '%Growth Tabung%' or title like '%Growth Tabung%'`
      )).rows;
      assert.equal(qMatches.length, 0);

      const qqMatches = (await db.query(
        `select * from public.quest_questions where prompt like '%Growth Tabung%' or explanation like '%Growth Tabung%'`
      )).rows;
      assert.equal(qqMatches.length, 0);
    },
  },
  {
    name: '10. Access control: anon and authenticated cannot access investments or execute RPCs',
    fn: async (db) => {
      await expectError(
        asRole(db, 'anon', () => db.query(`select * from public.investments`)),
        'permission denied'
      );
      await expectError(
        asRole(db, 'authenticated', () => db.query(`select * from public.investments`)),
        'permission denied'
      );
      await expectError(
        asRole(db, 'anon', () => db.query(`select investment_fund_options()`)),
        'permission denied'
      );
      await expectError(
        asRole(db, 'authenticated', () => db.query(`select investment_fund_options()`)),
        'permission denied'
      );
    },
  },
];
