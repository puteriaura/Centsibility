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

      const row1 = (await db.query(`select * from public.investments where id = $1`, [res1.id])).rows[0];
      assert.equal(Number(row1.min_rate), -0.005);
      assert.equal(Number(row1.max_rate), 0.005);
      assert.equal(row1.protected, false);

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
      assert.ok(Number(path1[2].value) > 0);

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
    name: '5. Protected fund floors at principal; unprotected fund fluctuates below principal',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      // Unprotected fund with negative rates forced downward
      const invUnprotected = (await db.query(`
        insert into public.investments (
          kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
        ) values (
          $1, 'fund', 'Centsibility Fund (High)', 50.00, 'active', 'high', 'day', 14, 'seed-down', -0.02, -0.01, false
        ) returning id
      `, [kid.id])).rows[0];

      // Set to 15 days ago so all 14 ticks run
      await db.query(
        `update public.investments set created_at = now() - interval '15 days' where id = $1`,
        [invUnprotected.id]
      );

      const pathUnprotected = (await db.query(`select * from investment_fund_path($1, now())`, [invUnprotected.id])).rows;
      assert.equal(pathUnprotected.length, 14);
      // Path drops below principal (50.00)
      assert.ok(Number(pathUnprotected[13].value) < 50.00, `Expected final tick below 50.00, got ${pathUnprotected[13].value}`);

      // Protected fund with same negative rates floors at principal
      const invProtected = (await db.query(`
        insert into public.investments (
          kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
        ) values (
          $1, 'fund', 'Old Fund', 50.00, 'active', 'high', 'day', 14, 'seed-down', -0.02, -0.01, true
        ) returning id
      `, [kid.id])).rows[0];

      await db.query(
        `update public.investments set created_at = now() - interval '15 days' where id = $1`,
        [invProtected.id]
      );

      const pathProtected = (await db.query(`select * from investment_fund_path($1, now())`, [invProtected.id])).rows;
      assert.equal(pathProtected.length, 14);
      for (const pt of pathProtected) {
        assert.ok(Number(pt.value) >= 50.00, `Protected tick ${pt.tick} dropped below principal`);
      }
    },
  },
  {
    name: '6. Settlement: pays payout (up or down), writes INVEST_GAIN or INVEST_LOSS, notification, ledger invariant holds',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      // Settle a loss fund
      const invLoss = (await db.query(`
        insert into public.investments (
          kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
        ) values (
          $1, 'fund', 'Centsibility Fund (Low)', 20.00, 'active', 'low', 'minute', 5, 'seed-loss', -0.02, -0.01, false
        ) returning id
      `, [kid.id])).rows[0];

      await db.query(`update public.kids set balance = balance - 20 where id = $1`, [kid.id]);
      await db.query(
        `update public.investments set created_at = now() - interval '6 minutes' where id = $1`,
        [invLoss.id]
      );

      const settleLoss = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investments_settle($1) as data`, [kid.id])
      )).rows[0].data;

      assert.ok(Number(settleLoss.paid) < 20.00, `Expected payout < 20.00, got ${settleLoss.paid}`);

      // Check transactions
      const txs = (await db.query(`select * from public.transactions where kid_id = $1 order by created_at asc`, [kid.id])).rows;
      assert.ok(txs.some((t) => t.type === 'INVEST_OUT' && Number(t.amount) === Number(settleLoss.paid)));
      assert.ok(txs.some((t) => t.type === 'INVEST_LOSS'));

      // Check notification
      const notifs = (await db.query(`select * from public.kid_notifications where kid_id = $1 order by created_at desc`, [kid.id])).rows;
      assert.ok(notifs[0].message.includes('became RM') && notifs[0].message.includes('back in your spending money'));

      // Ledger invariant holds: balance is initial (100) - 20 (invested) + settleLoss.paid
      const curBal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(curBal).toFixed(2), (80.00 + Number(settleLoss.paid)).toFixed(2));
    },
  },
  {
    name: '7. Early close: protected returns principal; unprotected returns current value + gain/loss',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });

      // 1. Protected fund
      const invProt = (await db.query(`
        insert into public.investments (
          kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
        ) values (
          $1, 'fund', 'Old Protected', 20.00, 'active', 'low', 'day', 7, 's1', 0.001, 0.010, true
        ) returning id
      `, [kid.id])).rows[0];
      await db.query(`update public.kids set balance = balance - 20 where id = $1`, [kid.id]);

      const closeProt = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid) as data`, [kid.id, invProt.id])
      )).rows[0].data;
      assert.equal(Number(closeProt.payout), 20.00);

      // 2. Unprotected fund with negative rate
      const invUnprot = (await db.query(`
        insert into public.investments (
          kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
        ) values (
          $1, 'fund', 'New Unprotected', 20.00, 'active', 'high', 'day', 7, 's2', -0.02, -0.01, false
        ) returning id
      `, [kid.id])).rows[0];
      await db.query(`update public.kids set balance = balance - 20 where id = $1`, [kid.id]);

      // Age by 3 days so current value has moved
      await db.query(`update public.investments set created_at = now() - interval '3 days' where id = $1`, [invUnprot.id]);

      const closeUnprot = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2::uuid) as data`, [kid.id, invUnprot.id])
      )).rows[0].data;
      assert.ok(Number(closeUnprot.payout) < 20.00, `Unprotected early close payout should be < 20.00, got ${closeUnprot.payout}`);

      // Transaction row includes INVEST_LOSS
      const txs = (await db.query(`select * from public.transactions where kid_id = $1 and label = 'Investment loss'`, [kid.id])).rows;
      assert.ok(txs.length >= 1);

      // Second close fails with already_resolved
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_close($1, $2::uuid)`, [kid.id, invUnprot.id])
        ),
        'already_resolved'
      );
    },
  },
  {
    name: '8. Growth Tabung migration preserves total balances and converts to weekly fund with protected = true',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 25, invest_balance: 35, risk_appetite: 'high' });

      // Run migration block with old ranges and protected = true
      await db.query(`
        do $$
        declare
          k record;
          v_tier text;
          v_seed text;
          v_min numeric(8,5);
          v_max numeric(8,5);
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
            v_min := case v_tier when 'low' then 0.001 when 'medium' then 0.001 when 'high' then -0.020 else 0.001 end;
            v_max := case v_tier when 'low' then 0.010 when 'medium' then 0.030 when 'high' then 0.050 else 0.010 end;
            v_seed := md5(gen_random_uuid()::text || clock_timestamp()::text);
            insert into public.investments (
              kid_id, mode, label, principal, status, tier, frequency, lock_ticks, seed, min_rate, max_rate, protected
            ) values (
              k.id, 'fund', 'Moved from Growth Tabung', round(k.invest_balance, 2), 'active',
              v_tier, 'week', 4, v_seed, v_min, v_max, true
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
      assert.equal(invs[0].protected, true);
      assert.equal(Number(invs[0].min_rate), -0.02);
      assert.equal(Number(invs[0].max_rate), 0.05);

      // Can be taken out early at any time, returns exactly principal
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
  {
    name: '11. Backfill gave every pre-existing fund row protected = true and old range',
    fn: async (db) => {
      const invalidRows = (await db.query(`
        select count(*) from public.investments
        where mode = 'fund' and (min_rate is null or max_rate is null or protected is null)
      `)).rows[0].count;
      assert.equal(Number(invalidRows), 0);
    },
  },
  {
    name: '12. Exactly one kid_investment_close function in pg_proc',
    fn: async (db) => {
      const funcs = (await db.query(`
        select proname, pronargs from pg_proc where proname = 'kid_investment_close'
      `)).rows;
      assert.equal(funcs.length, 1);
      assert.equal(funcs[0].pronargs, 3);
    },
  },
];

