import assert from 'node:assert/strict';

export const tests = [
  {
    name: '1. trigger on auth.users derives display_name from Google metadata or email',
    fn: async (db) => {
      // 1. Google user with full_name
      const res1 = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        ['tariq@gmail.com', JSON.stringify({ full_name: 'Tariq Aziz' })]
      );
      const id1 = res1.rows[0].id;
      const p1 = (await db.query(`select display_name from public.profiles where id = $1`, [id1])).rows[0];
      assert.ok(p1, 'profile created by trigger');
      assert.equal(p1.display_name, 'Tariq Aziz');

      // 2. Google user with name only
      const res2 = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        ['aisha@gmail.com', JSON.stringify({ name: 'Aisha Bakar' })]
      );
      const id2 = res2.rows[0].id;
      const p2 = (await db.query(`select display_name from public.profiles where id = $1`, [id2])).rows[0];
      assert.ok(p2, 'profile created by trigger');
      assert.equal(p2.display_name, 'Aisha Bakar');

      // 3. User with display_name taking precedence over full_name
      const res3 = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        ['custom@example.com', JSON.stringify({ display_name: 'Custom Display', full_name: 'Other Full Name' })]
      );
      const id3 = res3.rows[0].id;
      const p3 = (await db.query(`select display_name from public.profiles where id = $1`, [id3])).rows[0];
      assert.ok(p3, 'profile created by trigger');
      assert.equal(p3.display_name, 'Custom Display');

      // 4. User with empty metadata falls back to email prefix
      const res4 = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        ['yusuf.ali@example.com', JSON.stringify({})]
      );
      const id4 = res4.rows[0].id;
      const p4 = (await db.query(`select display_name from public.profiles where id = $1`, [id4])).rows[0];
      assert.ok(p4, 'profile created by trigger');
      assert.equal(p4.display_name, 'yusuf.ali');

      // 5. User with blank strings falls back to email prefix
      const res5 = await db.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        ['maryam@example.com', JSON.stringify({ display_name: '', full_name: '', name: '' })]
      );
      const id5 = res5.rows[0].id;
      const p5 = (await db.query(`select display_name from public.profiles where id = $1`, [id5])).rows[0];
      assert.ok(p5, 'profile created by trigger');
      assert.equal(p5.display_name, 'maryam');
    },
  },
];
