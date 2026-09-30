import assert from 'node:assert/strict';
import { seedParent, seedKid, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. pin cutover resets kids and parents, assigns unique 6-char code, and enforces comfort_name check',
    fn: async (db) => {
      const parentId = await seedParent(db);

      // Seed commander_pins and parent_pin_sessions for the parent
      await db.query(
        `insert into public.commander_pins (parent_id, pin_hash, failed_attempts) values ($1, $2, $3)`,
        [parentId, 'some_parent_bcrypt_hash', 0]
      );
      await db.query(
        `insert into public.parent_pin_sessions (parent_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')`,
        [parentId, 'some_token_hash']
      );

      // Seed kid 1 with established PIN and active session
      const kid1 = await seedKid(db, parentId, {
        hashed_pin: 'existing_kid_pin_hash',
        session_token: 'existing_kid_session_token',
        failed_login_attempts: 3,
        locked_until: new Date(Date.now() + 600000).toISOString(),
      });

      // Seed kid 2 without PIN
      const kid2 = await seedKid(db, parentId, {
        hashed_pin: null,
        session_token: null,
        failed_login_attempts: 0,
      });

      // Execute the cutover migration logic
      const cutoverSql = `
        DO $$
        DECLARE
          v_kid record;
          v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          v_code text;
          v_i int;
          v_collision boolean;
        BEGIN
          FOR v_kid IN SELECT id FROM public.kids LOOP
            LOOP
              v_code := '';
              FOR v_i IN 1..6 LOOP
                v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
              END LOOP;

              SELECT EXISTS (
                SELECT 1 FROM public.kids WHERE login_code = v_code AND id <> v_kid.id
              ) INTO v_collision;

              EXIT WHEN NOT v_collision;
            END LOOP;

            UPDATE public.kids
               SET hashed_pin = NULL,
                   session_token = NULL,
                   login_code = v_code,
                   failed_login_attempts = 0,
                   locked_until = NULL
             WHERE id = v_kid.id;
          END LOOP;
        END $$;

        DELETE FROM public.commander_pins;
        DELETE FROM public.parent_pin_sessions;
      `;
      await db.exec(cutoverSql);

      // Check kids state
      const kidsAfter = (await db.query(`select id, hashed_pin, session_token, login_code, failed_login_attempts, locked_until from public.kids`)).rows;
      assert.ok(kidsAfter.length >= 2, 'at least 2 kids exist');

      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const codes = new Set();

      for (const k of kidsAfter) {
        assert.equal(k.hashed_pin, null, `kid ${k.id} hashed_pin is null`);
        assert.equal(k.session_token, null, `kid ${k.id} session_token is null`);
        assert.equal(k.failed_login_attempts, 0, `kid ${k.id} failed_login_attempts is 0`);
        assert.equal(k.locked_until, null, `kid ${k.id} locked_until is null`);
        assert.equal(k.login_code.length, 6, `kid ${k.id} code is 6 characters`);

        for (const char of k.login_code) {
          assert.ok(alphabet.includes(char), `character ${char} in alphabet`);
        }
        assert.ok(!codes.has(k.login_code), `code ${k.login_code} is unique`);
        codes.add(k.login_code);
      }

      // Check parent pins and sessions are emptied
      const parentPins = (await db.query(`select count(*) from public.commander_pins`)).rows[0].count;
      assert.equal(Number(parentPins), 0, 'commander_pins is empty');

      const parentSessions = (await db.query(`select count(*) from public.parent_pin_sessions`)).rows[0].count;
      assert.equal(Number(parentSessions), 0, 'parent_pin_sessions is empty');

      // Check comfort_name constraints
      // Empty string should fail check
      await expectError(
        db.query(`update public.kids set comfort_name = '' where id = $1`, [kid1.id]),
        'kids_comfort_name_check'
      );

      // Whitespace-only should fail check (btrim is empty)
      await expectError(
        db.query(`update public.kids set comfort_name = '   ' where id = $1`, [kid1.id]),
        'kids_comfort_name_check'
      );

      // 31 characters should fail check
      await expectError(
        db.query(`update public.kids set comfort_name = '1234567890123456789012345678901' where id = $1`, [kid1.id]),
        'kids_comfort_name_check'
      );

      // Valid name 'Aiman' should succeed
      await db.query(`update public.kids set comfort_name = 'Aiman' where id = $1`, [kid1.id]);
      const updated = (await db.query(`select comfort_name from public.kids where id = $1`, [kid1.id])).rows[0];
      assert.equal(updated.comfort_name, 'Aiman');
    },
  },
];
