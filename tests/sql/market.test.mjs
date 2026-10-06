import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

async function seedQuote(db, symbol, price, isMarketOpen = false, fetchedAt = 'now()') {
  await db.query(
    `insert into public.market_quotes (symbol, price, previous_close, is_market_open, fetched_at)
     values ($1, $2, $2, $3, ${fetchedAt})
     on conflict (symbol) do update set
       price = excluded.price,
       previous_close = excluded.previous_close,
       is_market_open = excluded.is_market_open,
       fetched_at = excluded.fetched_at`,
    [symbol, price, isMarketOpen]
  );
}

export const tests = [
  {
    name: '1. age defaults and parent override for market tracker',
    fn: async (db) => {
      const parentId = await seedParent(db);
      await seedQuote(db, 'SPUS', 50.00, false);

      // 9-year-old: default market_tracker_enabled is null -> off by age default
      const kid9 = await seedKid(db, parentId, {
        age_group_override: '6-9',
        balance: 100,
        market_tracker_enabled: null,
      });
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 5.00)`, [kid9.id])
        ),
        'market_off'
      );

      // Parent enables for 9-year-old -> can open
      await db.query(`update public.kids set market_tracker_enabled = true where id = $1`, [kid9.id]);
      const res9 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 5.00) as data`, [kid9.id])
      )).rows[0].data;
      assert.equal(res9.symbol, 'SPUS');
      assert.equal(Number(res9.principal), 5.00);

      // 10-12: default null -> off
      const kid11 = await seedKid(db, parentId, {
        age_group_override: '10-12',
        balance: 100,
        market_tracker_enabled: null,
      });
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 5.00)`, [kid11.id])
        ),
        'market_off'
      );

      // 13-17: default null -> on by age default
      const kid15 = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 100,
        market_tracker_enabled: null,
      });
      const res15 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00) as data`, [kid15.id])
      )).rows[0].data;
      assert.equal(res15.symbol, 'SPUS');
      assert.equal(Number(res15.principal), 10.00);

      // Parent disables for 13-17 -> market_off
      await db.query(`update public.kids set market_tracker_enabled = false where id = $1`, [kid15.id]);
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 10.00)`, [kid15.id])
        ),
        'market_off'
      );
    },
  },
  {
    name: '2. limits by age and max 5 open market investments',
    fn: async (db) => {
      const parentId = await seedParent(db);
      await seedQuote(db, 'SPUS', 50.00, false);
      await seedQuote(db, 'HLAL', 40.00, false);
      await seedQuote(db, 'AAPL', 150.00, false);

      // 6-9: max RM10 per inv, RM20 total exposure
      const kid6 = await seedKid(db, parentId, {
        age_group_override: '6-9',
        balance: 100,
        market_tracker_enabled: true,
      });
      // amount > 10.00 fails
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 11.00)`, [kid6.id])
        ),
        'limit_reached'
      );
      // open 10
      await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00)`, [kid6.id])
      );
      // open another 10 (total 20)
      await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'HLAL', 10.00)`, [kid6.id])
      );
      // third open of 1.00 fails total limit
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'AAPL', 1.00)`, [kid6.id])
        ),
        'limit_reached'
      );

      // 10-12: max RM20 per inv, RM50 total
      const kid10 = await seedKid(db, parentId, {
        age_group_override: '10-12',
        balance: 100,
        market_tracker_enabled: true,
      });
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 21.00)`, [kid10.id])
        ),
        'limit_reached'
      );

      // 13-17: max RM50 per inv, RM150 total, max 5 open
      const kid13 = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 500,
        market_tracker_enabled: true,
      });
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 51.00)`, [kid13.id])
        ),
        'limit_reached'
      );

      // Open 5 active market investments
      for (let i = 0; i < 5; i++) {
        await asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 10.00)`, [kid13.id])
        );
      }
      // 6th fails max 5 open
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 5.00)`, [kid13.id])
        ),
        'limit_reached'
      );
    },
  },
  {
    name: '3. stale_quote handling for both market open and closed',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 100,
      });

      // Market open: fetched 20 mins ago -> open fails with stale_quote
      await seedQuote(db, 'SPUS', 50.00, true, "now() - interval '20 minutes'");
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 10.00)`, [kid.id])
        ),
        'stale_quote'
      );

      // Market open: fetched 5 mins ago -> succeeds
      await seedQuote(db, 'SPUS', 50.00, true, "now() - interval '5 minutes'");
      const inv = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00) as data`, [kid.id])
      )).rows[0].data;
      assert.ok(inv.entry_price_at);

      // Sell when market open and quote is 35 mins old -> fails with stale_quote
      await seedQuote(db, 'SPUS', 55.00, true, "now() - interval '35 minutes'");
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_close($1, $2)`, [kid.id, inv.id])
        ),
        'stale_quote'
      );

      // Sell when market open and quote is 20 mins old -> succeeds
      await seedQuote(db, 'SPUS', 55.00, true, "now() - interval '20 minutes'");
      const closeRes = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2) as data`, [kid.id, inv.id])
      )).rows[0].data;
      assert.equal(closeRes.success, true);

      // Market closed cache across US open:
      // Tuesday 14:00 UTC, cached "closed" quote 20 mins old -> stale_quote
      const tuesdayNow = '2026-10-06 14:00:00+00';
      await seedQuote(db, 'SPUS', 50.00, false, "'2026-10-06 13:40:00+00'");
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPUS', 10.00, null, $2::timestamptz)`, [kid.id, tuesdayNow])
        ),
        'stale_quote'
      );

      // Saturday 14:00 UTC, cached "closed" quote 20 mins old -> not stale (succeeds)
      const saturdayNow = '2026-10-10 14:00:00+00';
      await seedQuote(db, 'SPUS', 50.00, false, "'2026-10-10 13:40:00+00'");
      const invSat = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00, null, $2::timestamptz) as data`, [kid.id, saturdayNow])
      )).rows[0].data;
      assert.equal(invSat.symbol, 'SPUS');

      // Market closed outside window: quote fetched 2 hours ago is acceptable for both open and close
      await seedQuote(db, 'HLAL', 30.00, false, "'2026-10-10 12:00:00+00'");
      const inv2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'HLAL', 10.00, null, $2::timestamptz) as data`, [kid.id, saturdayNow])
      )).rows[0].data;
      assert.equal(inv2.symbol, 'HLAL');

      const closeRes2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2, $3::timestamptz) as data`, [kid.id, inv2.id, saturdayNow])
      )).rows[0].data;
      assert.equal(closeRes2.success, true);
    },
  },
  {
    name: '4. sell math for gain and loss below principal, ledger invariant',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 50.00,
      });

      // Case A: GAIN (entry: 50.00, sell: 60.00 -> +20%)
      await seedQuote(db, 'SPUS', 50.00, false);
      const invGain = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00) as data`, [kid.id])
      )).rows[0].data;

      // Balance dropped from 50 to 40
      const bal1 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(bal1), 40.00);

      // Quote rises to 60.00
      await seedQuote(db, 'SPUS', 60.00, false);
      const sellGain = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2) as data`, [kid.id, invGain.id])
      )).rows[0].data;
      assert.equal(Number(sellGain.payout), 12.00);

      // Balance now 40 + 12 = 52
      const bal2 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(bal2), 52.00);

      // Check transactions
      const txsG = (await db.query(`select * from public.transactions where kid_id = $1 order by created_at asc`, [kid.id])).rows;
      assert.ok(txsG.some((t) => t.type === 'INVEST_OUT' && Number(t.amount) === 12.00 && t.label === 'Sold Market: SPUS'));
      assert.ok(txsG.some((t) => t.type === 'INVEST_GAIN' && Number(t.amount) === 2.00));

      // Case B: LOSS below principal (entry: 100.00, sell: 80.00 -> -20%)
      await seedQuote(db, 'HLAL', 100.00, false);
      const invLoss = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'HLAL', 20.00) as data`, [kid.id])
      )).rows[0].data;

      // Balance dropped 52 - 20 = 32
      const bal3 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(bal3), 32.00);

      // Price drops to 80.00
      await seedQuote(db, 'HLAL', 80.00, false);
      const sellLoss = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2) as data`, [kid.id, invLoss.id])
      )).rows[0].data;
      assert.equal(Number(sellLoss.payout), 16.00);

      // Balance now 32 + 16 = 48
      const bal4 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(bal4), 48.00);

      // Ledger invariant:
      // Start (50) - 10 (inv1) + 12 (payout1) - 20 (inv2) + 16 (payout2) = 48.00
      assert.equal(Number(bal4).toFixed(2), (50 - 10 + 12 - 20 + 16).toFixed(2));

      const txsL = (await db.query(`select * from public.transactions where kid_id = $1 and type in ('INVEST_OUT', 'INVEST_LOSS') order by created_at desc`, [kid.id])).rows;
      assert.ok(txsL.some((t) => t.type === 'INVEST_OUT' && Number(t.amount) === 16.00 && t.label === 'Sold Market: HLAL'));
      assert.ok(txsL.some((t) => t.type === 'INVEST_LOSS' && Number(t.amount) === 4.00));
    },
  },
  {
    name: '5. sell twice raises already_resolved and pays once',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 50.00,
      });

      await seedQuote(db, 'SPUS', 50.00, false);
      const inv = (await asRole(db, 'service_role', () =>
        db.query(`select kid_market_open($1, 'SPUS', 10.00) as data`, [kid.id])
      )).rows[0].data;

      // First sell
      const close1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_investment_close($1, $2) as data`, [kid.id, inv.id])
      )).rows[0].data;
      assert.equal(close1.success, true);
      assert.equal(Number(close1.payout), 10.00);

      const balAfterFirst = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;

      // Second sell throws already_resolved
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_investment_close($1, $2)`, [kid.id, inv.id])
        ),
        'already_resolved'
      );

      // Balance unchanged
      const balAfterSecond = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(balAfterFirst, balAfterSecond);
    },
  },
  {
    name: '6. unknown or inactive symbol is refused',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        age_group_override: '13-17',
        balance: 50.00,
      });

      // Unknown symbol
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'UNKNOWN_SYM', 10.00)`, [kid.id])
        ),
        'invalid_symbol'
      );

      // Inactive symbol
      await db.query(`update public.market_symbols set active = false where symbol = 'SPTE'`);
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_market_open($1, 'SPTE', 10.00)`, [kid.id])
        ),
        'invalid_symbol'
      );
    },
  },
  {
    name: '7. anon role cannot read the four market tables',
    fn: async (db) => {
      const tables = ['market_symbols', 'market_quotes', 'market_daily_closes', 'market_api_calls'];
      for (const t of tables) {
        await expectError(
          asRole(db, 'anon', () => db.query(`select count(*) from public.${t}`)),
          'permission denied'
        );
      }
    },
  },
  {
    name: '8. only one kid_investment_close function exists in pg_proc',
    fn: async (db) => {
      const res = await db.query(
        `select count(*)::int as count from pg_proc where proname = 'kid_investment_close'`
      );
      assert.equal(res.rows[0].count, 1);

      const resMarketOpen = await db.query(
        `select count(*)::int as count from pg_proc where proname = 'kid_market_open'`
      );
      assert.equal(resMarketOpen.rows[0].count, 1);
    },
  },
];
