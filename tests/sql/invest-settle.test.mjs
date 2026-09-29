import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Re-audit scenario: pot RM100, RM50 deposit via kid_invest_transfer, settle over 3 weeks',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        balance: 100,
        invest_balance: 100,
        invest_rate: 0.001,
      });

      // Set invest_last_paid to 21 days ago (3 weeks)
      await db.query(`update public.kids set invest_last_paid = now() - interval '21 days' where id = $1`, [kid.id]);

      // Deposit RM50 into investment pot
      await asRole(db, 'service_role', () =>
        db.query(`select kid_invest_transfer($1, 'IN', 50.00)`, [kid.id])
      );

      // Verify intermediate state: balance=50, invest_balance=150
      const midKid = (await db.query(`select balance, invest_balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(midKid.balance), 50.00);
      assert.equal(Number(midKid.invest_balance), 150.00);

      // Settle
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      const paid = Number(res.paid);
      const newBal = Number(res.invest_balance);

      // Invariant: balance must equal 150 + gain, NEVER computed from old 100
      assert.equal(newBal, Number((150.00 + paid).toFixed(2)));
      assert.ok(newBal > 130.00, `Expected balance > 130 (based on 150 principal), got ${newBal}`);

      // Kid row matches
      const finalKid = (await db.query(`select balance, invest_balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(finalKid.balance), 50.00); // Wallet unchanged
      assert.equal(Number(finalKid.invest_balance), newBal);
    },
  },
  {
    name: '2. Wallet balance is unchanged by settlement',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        balance: 85.25,
        invest_balance: 120.00,
        invest_rate: 0.002,
      });

      await db.query(`update public.kids set invest_last_paid = now() - interval '14 days' where id = $1`, [kid.id]);

      await asRole(db, 'service_role', () =>
        db.query(`select kid_invest_settle($1)`, [kid.id])
      );

      const finalKid = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(finalKid.balance), 85.25);
    },
  },
  {
    name: '3. One INVEST_GAIN/INVEST_LOSS row per settlement, equal to change in invest_balance',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        balance: 100,
        invest_balance: 200.00,
        invest_rate: 0.002,
      });

      await db.query(`update public.kids set invest_last_paid = now() - interval '14 days' where id = $1`, [kid.id]);

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      const paid = Number(res.paid);
      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;

      if (paid !== 0) {
        assert.equal(txs.length, 1);
        const tx = txs[0];
        assert.equal(tx.type, paid > 0 ? 'INVEST_GAIN' : 'INVEST_LOSS');
        assert.equal(Number(tx.amount), Math.abs(paid));
        assert.equal(tx.label, `Investment ${paid > 0 ? 'growth' : 'loss'} (2w)`);
      } else {
        assert.equal(txs.length, 0);
      }
    },
  },
  {
    name: '4. Settling twice in a row pays 0 the second time',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        balance: 100,
        invest_balance: 100.00,
        invest_rate: 0.001,
      });

      await db.query(`update public.kids set invest_last_paid = now() - interval '14 days' where id = $1`, [kid.id]);

      // First settle
      await asRole(db, 'service_role', () =>
        db.query(`select kid_invest_settle($1)`, [kid.id])
      );

      const countAfterFirst = (await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count;

      // Second settle immediately
      const res2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      assert.equal(Number(res2.paid), 0);

      const countAfterSecond = (await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(countAfterSecond, countAfterFirst);
    },
  },
  {
    name: '5. invest_last_paid moves forward by exactly weeks * 7 days',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        invest_balance: 100.00,
        invest_rate: 0.001,
      });

      // Set to 25 days ago (floor(25/7) = 3 weeks = 21 days advance)
      await db.query(`update public.kids set invest_last_paid = now() - interval '25 days' where id = $1`, [kid.id]);
      const prevLastPaid = (await db.query(`select invest_last_paid from public.kids where id = $1`, [kid.id])).rows[0].invest_last_paid;

      await asRole(db, 'service_role', () =>
        db.query(`select kid_invest_settle($1)`, [kid.id])
      );

      const check = (await db.query(
        `select (invest_last_paid = ($2::timestamptz + interval '21 days')) as is_exact from public.kids where id = $1`,
        [kid.id, prevLastPaid]
      )).rows[0];

      assert.equal(check.is_exact, true);
    },
  },
  {
    name: '6. For rate 0.001 over 1 week, result stays inside [0.99, 1.03] * principal',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        invest_balance: 1000.00,
        invest_rate: 0.001,
      });

      await db.query(`update public.kids set invest_last_paid = now() - interval '7 days' where id = $1`, [kid.id]);

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      const newBal = Number(res.invest_balance);
      const paid = Number(res.paid);

      assert.ok(newBal >= 990.00, `Expected balance >= 990.00, got ${newBal}`);
      assert.ok(newBal <= 1030.00, `Expected balance <= 1030.00, got ${newBal}`);
      assert.ok(paid >= -10.00, `Expected paid >= -10.00, got ${paid}`);
      assert.ok(paid <= 30.00, `Expected paid <= 30.00, got ${paid}`);
    },
  },
  {
    name: '7. The zero-principal path updates invest_last_paid and returns paid: 0',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        invest_balance: 0,
        invest_rate: 0.002,
      });

      await db.query(`update public.kids set invest_last_paid = now() - interval '14 days' where id = $1`, [kid.id]);
      const prevLastPaid = (await db.query(`select invest_last_paid from public.kids where id = $1`, [kid.id])).rows[0].invest_last_paid;

      const res = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_invest_settle($1) as data`, [kid.id])).rows[0].data
      );

      assert.equal(Number(res.paid), 0);
      assert.equal(Number(res.invest_balance), 0);

      // Verify date advanced 14 days
      const check = (await db.query(
        `select (invest_last_paid = ($2::timestamptz + interval '14 days')) as is_exact from public.kids where id = $1`,
        [kid.id, prevLastPaid]
      )).rows[0];
      assert.equal(check.is_exact, true);

      // 0 transactions
      const txs = (await db.query(`select * from public.transactions where kid_id = $1`, [kid.id])).rows;
      assert.equal(txs.length, 0);
    },
  },
  {
    name: '8. Backfill converts growth and loss rows and leaves others alone',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      const r1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label) values ($1, 'HIBAH', 15.00, 'Investment growth (2w)') returning id`,
        [kid.id]
      )).rows[0].id;
      const r2 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label) values ($1, 'INVEST_OUT', 8.50, 'Investment loss (1w)') returning id`,
        [kid.id]
      )).rows[0].id;
      const r3 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label) values ($1, 'HIBAH', 20.00, 'Weekly reward from parent') returning id`,
        [kid.id]
      )).rows[0].id;
      const r4 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label) values ($1, 'INVEST_OUT', 50.00, 'Recall to main wallet') returning id`,
        [kid.id]
      )).rows[0].id;

      // Re-run the backfill queries
      await db.exec(`
        UPDATE public.transactions
           SET type = 'INVEST_GAIN'
         WHERE type = 'HIBAH'
           AND label ~ '^Investment growth \\(\\d+w\\)$';

        UPDATE public.transactions
           SET type = 'INVEST_LOSS'
         WHERE type = 'INVEST_OUT'
           AND label ~ '^Investment loss \\(\\d+w\\)$';
      `);

      const getTx = async (id) => (await db.query(`select type, label from public.transactions where id = $1`, [id])).rows[0];

      assert.equal((await getTx(r1)).type, 'INVEST_GAIN');
      assert.equal((await getTx(r2)).type, 'INVEST_LOSS');
      assert.equal((await getTx(r3)).type, 'HIBAH');
      assert.equal((await getTx(r4)).type, 'INVEST_OUT');
    },
  },
  {
    name: '9. Grants: anon and authenticated cannot call kid_invest_settle, service_role can',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      for (const role of ['anon', 'authenticated']) {
        await asRole(db, role, () =>
          expectError(
            db.query(`select kid_invest_settle($1)`, [kid.id]),
            'permission denied'
          )
        );
      }

      await asRole(db, 'service_role', () =>
        db.query(`select kid_invest_settle($1)`, [kid.id])
      );
    },
  },
];
