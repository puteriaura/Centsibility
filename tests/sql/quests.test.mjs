import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. kid_age_group: override, birth_date, birth_year, defaults, and boundary ages',
    fn: async (db) => {
      const parentId = await seedParent(db);

      // Default: nothing set -> 10-12
      const kidDefault = await seedKid(db, parentId, { name: 'DefaultKid' });
      const grpDefault = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidDefault.id])
      )).rows[0].grp;
      assert.equal(grpDefault, '10-12');

      // Override wins over birth_date
      const kidOverride = await seedKid(db, parentId, {
        name: 'Overridden',
        birth_date: '2010-05-15',
        age_group_override: '6-9',
      });
      const grpOverride = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidOverride.id])
      )).rows[0].grp;
      assert.equal(grpOverride, '6-9');

      // birth_date: 2019-01-01 -> 6-9
      const kidYoung = await seedKid(db, parentId, {
        name: 'Young',
        birth_date: '2019-01-01',
      });
      const grpYoung = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidYoung.id])
      )).rows[0].grp;
      assert.equal(grpYoung, '6-9');

      // Age under 6 (e.g. 5) -> 6-9
      const currentYear = new Date().getFullYear();
      const kidAge5 = await seedKid(db, parentId, {
        name: 'Age5',
        birth_date: `${currentYear - 5}-06-01`,
      });
      const grp5 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidAge5.id])
      )).rows[0].grp;
      assert.equal(grp5, '6-9');

      // Age over 17 (e.g. 18) -> 13-17
      const kidAge18 = await seedKid(db, parentId, {
        name: 'Age18',
        birth_date: `${currentYear - 18}-01-01`,
      });
      const grp18 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidAge18.id])
      )).rows[0].grp;
      assert.equal(grp18, '13-17');

      // Only birth_year set (e.g. 11 years old) -> 10-12
      const kidYear = await seedKid(db, parentId, {
        name: 'YearKid',
        birth_year: currentYear - 11,
      });
      const grpYear = (await asRole(db, 'service_role', () =>
        db.query(`select kid_age_group($1) as grp`, [kidYear.id])
      )).rows[0].grp;
      assert.equal(grpYear, '10-12');
    },
  },
  {
    name: '2. kid_quest_board: quest 1 open, subsequent locked; opens sequentially as completed',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { name: 'BoardKid', age_group_override: '10-12' });

      const board1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_board($1) as data`, [kid.id])
      )).rows[0].data;

      assert.equal(board1.ageGroup, '10-12');
      assert.equal(board1.quests.length, 8);
      assert.equal(board1.quests[0].position, 1);
      assert.equal(board1.quests[0].status, 'open');
      assert.equal(board1.quests[1].status, 'locked');
      assert.equal(board1.quests[2].status, 'locked');

      // Simulate completion of quest 1
      await db.query(
        `insert into public.quest_completions (kid_id, quest_id, points_awarded, best_correct)
         values ($1, $2, 400, 3)`,
        [kid.id, board1.quests[0].id]
      );

      const board2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_board($1) as data`, [kid.id])
      )).rows[0].data;

      assert.equal(board2.quests[0].status, 'done');
      assert.equal(board2.quests[1].status, 'open');
      assert.equal(board2.quests[2].status, 'locked');
    },
  },
  {
    name: '3. kid_quest_start: prevents locked/cross-group quests and never leaks correct answers',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { name: 'StartKid', age_group_override: '10-12' });

      const quests1012 = (await db.query(
        `select * from public.quests where age_group = '10-12' and active = true order by position`
      )).rows;
      const quests69 = (await db.query(
        `select * from public.quests where age_group = '6-9' and active = true order by position`
      )).rows;

      // Locked quest (position 2 without completing position 1) -> quest_locked
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_start($1, $2)`, [kid.id, quests1012[1].id])
        ),
        'quest_locked'
      );

      // Quest from wrong group -> not_found
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_start($1, $2)`, [kid.id, quests69[0].id])
        ),
        'not_found'
      );

      // Happy path start for quest 1
      const startRes = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid.id, quests1012[0].id])
      )).rows[0].data;

      assert(startRes.attemptId, 'Must return attemptId');
      assert.equal(startRes.quest.title, quests1012[0].title);
      assert.equal(startRes.quest.points, 400);
      assert(startRes.questions.length >= 3, 'Must have at least 3 questions');

      // Security verify: no correct_index or explanation leaked
      const resStr = JSON.stringify(startRes);
      assert(!resStr.includes('correct_index'), 'Leaked correct_index in start response!');
      assert(!resStr.includes('correctIndex'), 'Leaked correctIndex in start response!');
      assert(!resStr.includes('explanation'), 'Leaked explanation in start response!');
    },
  },
  {
    name: '4. kid_quest_answer: choice grading, already_answered, invalid_choice, wrong kid, and finished attempts',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid1 = await seedKid(db, parentId, { name: 'AnsKid1', age_group_override: '10-12' });
      const kid2 = await seedKid(db, parentId, { name: 'AnsKid2', age_group_override: '10-12' });

      const quest = (await db.query(
        `select * from public.quests where age_group = '10-12' and position = 1 and active = true`
      )).rows[0];
      const questions = (await db.query(
        `select * from public.quest_questions where quest_id = $1 order by position`,
        [quest.id]
      )).rows;

      const startRes = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid1.id, quest.id])
      )).rows[0].data;
      const attemptId = startRes.attemptId;

      // Another kid attempting to answer -> not_found
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, 0)`, [kid2.id, attemptId, questions[0].id])
        ),
        'not_found'
      );

      // Invalid choice (e.g. 99) -> invalid_choice
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, 99)`, [kid1.id, attemptId, questions[0].id])
        ),
        'invalid_choice'
      );

      // Negative choice -> invalid_choice
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, -1)`, [kid1.id, attemptId, questions[0].id])
        ),
        'invalid_choice'
      );

      // Question not in quest -> not_found
      const foreignQuestion = (await db.query(
        `select * from public.quest_questions where quest_id <> $1 limit 1`,
        [quest.id]
      )).rows[0];
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, 0)`, [kid1.id, attemptId, foreignQuestion.id])
        ),
        'not_found'
      );

      // First question answered correctly
      const ans1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_answer($1, $2, $3, $4) as data`, [
          kid1.id,
          attemptId,
          questions[0].id,
          questions[0].correct_index,
        ])
      )).rows[0].data;

      assert.equal(ans1.correct, true);
      assert.equal(ans1.correctIndex, questions[0].correct_index);
      assert.equal(ans1.explanation, questions[0].explanation);
      assert.equal(ans1.done, false);
      assert.equal(ans1.correctCount, 1);

      // Answering same question again -> already_answered
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4)`, [
            kid1.id,
            attemptId,
            questions[0].id,
            questions[0].correct_index,
          ])
        ),
        'already_answered'
      );
    },
  },
  {
    name: '5. Points once: passing awards points and notification once; replaying yields practice only',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        name: 'PointsKid',
        coins: 100,
        xp: 10,
        level: 1,
        age_group_override: '10-12',
      });

      const quest = (await db.query(
        `select * from public.quests where age_group = '10-12' and position = 1 and active = true`
      )).rows[0];
      const questions = (await db.query(
        `select * from public.quest_questions where quest_id = $1 order by position`,
        [quest.id]
      )).rows;

      // First attempt: answer all questions correctly
      const start1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid.id, quest.id])
      )).rows[0].data;

      let lastRes;
      for (const q of questions) {
        lastRes = (await asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4) as data`, [
            kid.id,
            start1.attemptId,
            q.id,
            q.correct_index,
          ])
        )).rows[0].data;
      }

      assert.equal(lastRes.done, true);
      assert.equal(lastRes.passed, true);
      assert.equal(lastRes.pointsAwarded, 400);
      assert.equal(lastRes.firstCompletion, true);

      // Check kid balance: 100 + 400 = 500 coins
      const kidAfter = (await db.query(`select coins, xp, level from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.coins), 500);
      assert.equal(Number(kidAfter.xp), 10 + 5 * questions.length);

      // Check 1 completion row and 1 notification row
      const comps = (await db.query(`select * from public.quest_completions where kid_id = $1`, [kid.id])).rows;
      assert.equal(comps.length, 1);
      assert.equal(comps[0].points_awarded, 400);

      const notes = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(notes.length, 1);
      assert(notes[0].message.includes('400 points'));

      // Trying to answer on finished attempt -> attempt_finished
      await expectError(
        asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4)`, [
            kid.id,
            start1.attemptId,
            questions[0].id,
            questions[0].correct_index,
          ])
        ),
        'attempt_finished'
      );

      // Second attempt (replay for practice)
      const start2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid.id, quest.id])
      )).rows[0].data;

      for (const q of questions) {
        lastRes = (await asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4) as data`, [
            kid.id,
            start2.attemptId,
            q.id,
            q.correct_index,
          ])
        )).rows[0].data;
      }

      assert.equal(lastRes.done, true);
      assert.equal(lastRes.passed, true);
      assert.equal(lastRes.pointsAwarded, 0);
      assert.equal(lastRes.firstCompletion, false);

      // Kid coins remain 500; no duplicate points or notifications
      const kidReplay = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidReplay.coins), 500);

      const compsReplay = (await db.query(`select * from public.quest_completions where kid_id = $1`, [kid.id])).rows;
      assert.equal(compsReplay.length, 1);

      const notesReplay = (await db.query(`select * from public.kid_notifications where kid_id = $1`, [kid.id])).rows;
      assert.equal(notesReplay.length, 1);
    },
  },
  {
    name: '6. Fail then pass: under 60% awards 0 points and no completion; subsequent pass awards points',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { name: 'RetryKid', coins: 0, age_group_override: '10-12' });

      const quest = (await db.query(
        `select * from public.quests where age_group = '10-12' and position = 1 and active = true`
      )).rows[0];
      const questions = (await db.query(
        `select * from public.quest_questions where quest_id = $1 order by position`,
        [quest.id]
      )).rows;

      // Fail attempt: answer all wrong
      const start1 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid.id, quest.id])
      )).rows[0].data;

      let lastRes;
      for (const q of questions) {
        const wrongChoice = (q.correct_index + 1) % 4;
        lastRes = (await asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4) as data`, [
            kid.id,
            start1.attemptId,
            q.id,
            wrongChoice,
          ])
        )).rows[0].data;
      }

      assert.equal(lastRes.done, true);
      assert.equal(lastRes.passed, false);
      assert.equal(lastRes.pointsAwarded, 0);

      const compsFail = (await db.query(`select * from public.quest_completions where kid_id = $1`, [kid.id])).rows;
      assert.equal(compsFail.length, 0);

      const kidCoinsFail = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0].coins;
      assert.equal(Number(kidCoinsFail), 0);

      // Now pass attempt
      const start2 = (await asRole(db, 'service_role', () =>
        db.query(`select kid_quest_start($1, $2) as data`, [kid.id, quest.id])
      )).rows[0].data;

      for (const q of questions) {
        lastRes = (await asRole(db, 'service_role', () =>
          db.query(`select kid_quest_answer($1, $2, $3, $4) as data`, [
            kid.id,
            start2.attemptId,
            q.id,
            q.correct_index,
          ])
        )).rows[0].data;
      }

      assert.equal(lastRes.done, true);
      assert.equal(lastRes.passed, true);
      assert.equal(lastRes.pointsAwarded, 400);
      assert.equal(lastRes.firstCompletion, true);

      const compsPass = (await db.query(`select * from public.quest_completions where kid_id = $1`, [kid.id])).rows;
      assert.equal(compsPass.length, 1);

      const kidCoinsPass = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0].coins;
      assert.equal(Number(kidCoinsPass), 400);
    },
  },
  {
    name: '7. Seed validation: 8 quests per group, choices counts, points rules, and forbidden characters check',
    fn: async (db) => {
      const groups = ['6-9', '10-12', '13-17'];
      const expectedPoints = { '6-9': 300, '10-12': 400, '13-17': 500 };
      const expectedChoices = { '6-9': 3, '10-12': 4, '13-17': 4 };

      for (const grp of groups) {
        const quests = (await db.query(
          `select * from public.quests where age_group = $1 and active = true order by position`,
          [grp]
        )).rows;

        assert.equal(quests.length, 8, `Group ${grp} must have exactly 8 active quests`);

        const correctIndicesCount = {};
        for (let c = 0; c < expectedChoices[grp]; c++) {
          correctIndicesCount[c] = 0;
        }

        for (let i = 0; i < quests.length; i++) {
          const q = quests[i];
          assert.equal(q.position, i + 1, `Quest ${q.slug} must have position ${i + 1}`);
          assert.equal(q.points, expectedPoints[grp], `Quest ${q.slug} points must match spec`);

          const questions = (await db.query(
            `select * from public.quest_questions where quest_id = $1 order by position`,
            [q.id]
          )).rows;

          if (grp === '13-17') {
            assert.equal(questions.length, 4, `Quest ${q.slug} must have 4 questions in 13-17`);
          } else {
            assert.equal(questions.length, 3, `Quest ${q.slug} must have 3 questions in ${grp}`);
          }

          for (const questQ of questions) {
            const choices = questQ.choices;
            assert.equal(choices.length, expectedChoices[grp], `Question ${questQ.prompt} must have ${expectedChoices[grp]} choices`);
            assert(questQ.correct_index >= 0 && questQ.correct_index < choices.length);
            correctIndicesCount[questQ.correct_index]++;

            // Forbidden characters: no em dash (—), no en dash (–), no underscore (_)
            for (const text of [questQ.prompt, questQ.explanation, ...choices]) {
              assert(!text.includes('—'), `Em dash found in: ${text}`);
              assert(!text.includes('–'), `En dash found in: ${text}`);
              assert(!text.includes('_'), `Underscore found in: ${text}`);
            }
          }
        }

        for (let c = 0; c < expectedChoices[grp]; c++) {
          assert(
            correctIndicesCount[c] >= 4,
            `Group ${grp} position ${c} must hold correct answer at least 4 times (got ${correctIndicesCount[c]})`
          );
        }
      }
    },
  },
  {
    name: '8. Access control: anon and authenticated cannot read quest tables or execute RPCs',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      for (const role of ['anon', 'authenticated']) {
        // Table access must fail or return empty under RLS
        for (const tbl of ['quests', 'quest_questions', 'quest_attempts', 'quest_completions']) {
          await expectError(
            asRole(db, role, () => db.query(`select count(*) from public.${tbl}`)),
            'permission denied'
          );
        }

        // Functions must fail execution
        await expectError(
          asRole(db, role, () => db.query(`select kid_age_group($1)`, [kid.id])),
          'permission denied'
        );
        await expectError(
          asRole(db, role, () => db.query(`select kid_quest_board($1)`, [kid.id])),
          'permission denied'
        );
      }
    },
  },
];
