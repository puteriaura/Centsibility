-- 20260930130000_age_quests.sql
-- Wave G Task 1 (T26): Age-based quests, quest attempts, and server-graded completions.
-- Rollback:
--   drop function if exists public.kid_quest_answer(uuid, uuid, uuid, int);
--   drop function if exists public.kid_quest_start(uuid, uuid);
--   drop function if exists public.kid_quest_board(uuid);
--   drop function if exists public.kid_age_group(uuid);
--   drop table if exists public.quest_completions cascade;
--   drop table if exists public.quest_attempts cascade;
--   drop table if exists public.quest_questions cascade;
--   drop table if exists public.quests cascade;
--   alter table public.kids drop column if exists age_group_override;

alter table public.kids add column if not exists age_group_override text
  check (age_group_override is null or age_group_override in ('6-9','10-12','13-17'));

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  age_group text not null check (age_group in ('6-9','10-12','13-17')),
  position int not null check (position >= 1),
  title text not null check (char_length(title) between 1 and 60),
  summary text not null check (char_length(summary) between 1 and 160),
  icon text not null default 'quest',
  points int not null check (points between 1 and 5000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (age_group, position)
);

create table if not exists public.quest_questions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  position int not null check (position >= 1),
  prompt text not null check (char_length(prompt) between 1 and 300),
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 2 and 4),
  correct_index int not null check (correct_index >= 0),
  explanation text not null check (char_length(explanation) between 1 and 300),
  check (correct_index < jsonb_array_length(choices)),
  unique (quest_id, position)
);

create table if not exists public.quest_attempts (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references public.kids(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,      -- { "<question id>": chosen index }
  correct_count int not null default 0,
  total int not null check (total between 1 and 10),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  passed boolean
);
create index if not exists quest_attempts_kid_quest_idx on public.quest_attempts (kid_id, quest_id);

create table if not exists public.quest_completions (
  kid_id uuid not null references public.kids(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  completed_at timestamptz not null default now(),
  points_awarded int not null,
  best_correct int not null,
  primary key (kid_id, quest_id)
);

-- RLS enabled with NO client policies; strictly accessible via service_role / RPC
alter table public.quests enable row level security;
alter table public.quest_questions enable row level security;
alter table public.quest_attempts enable row level security;
alter table public.quest_completions enable row level security;

revoke all on public.quests from public, anon, authenticated;
revoke all on public.quest_questions from public, anon, authenticated;
revoke all on public.quest_attempts from public, anon, authenticated;
revoke all on public.quest_completions from public, anon, authenticated;

grant select, insert, update, delete on public.quests to service_role;
grant select, insert, update, delete on public.quest_questions to service_role;
grant select, insert, update, delete on public.quest_attempts to service_role;
grant select, insert, update, delete on public.quest_completions to service_role;

-- ---------------------------------------------------------------------------
-- Function: kid_age_group
-- Determines age group in Malaysia time: override -> birth_date -> birth_year -> default 10-12
-- ---------------------------------------------------------------------------
create or replace function public.kid_age_group(p_kid_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_override text;
  v_bdate date;
  v_byear int;
  v_age int;
begin
  select age_group_override, birth_date, birth_year
  into v_override, v_bdate, v_byear
  from public.kids
  where id = p_kid_id;

  if v_override is not null and v_override in ('6-9', '10-12', '13-17') then
    return v_override;
  end if;

  if v_bdate is not null then
    v_age := extract(year from age((now() at time zone 'Asia/Kuala_Lumpur')::date, v_bdate))::int;
  elsif v_byear is not null then
    v_age := extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::int - v_byear;
  else
    return '10-12';
  end if;

  if v_age < 10 then
    return '6-9';
  elsif v_age >= 10 and v_age <= 12 then
    return '10-12';
  else
    return '13-17';
  end if;
end;
$$;

revoke all on function public.kid_age_group(uuid) from public, anon, authenticated;
grant execute on function public.kid_age_group(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Function: kid_quest_board
-- Returns active quests for the kid's age group with status: done, open, or locked
-- ---------------------------------------------------------------------------
create or replace function public.kid_quest_board(p_kid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group text;
  v_quests jsonb;
  v_rec record;
  v_status text;
  v_prev_done boolean := true;
  v_arr jsonb := '[]'::jsonb;
begin
  v_group := public.kid_age_group(p_kid_id);

  for v_rec in (
    select
      q.id,
      q.slug,
      q.title,
      q.summary,
      q.icon,
      q.points,
      q.position,
      (select count(*)::int from public.quest_questions qq where qq.quest_id = q.id) as question_count,
      qc.completed_at,
      qc.best_correct
    from public.quests q
    left join public.quest_completions qc on qc.quest_id = q.id and qc.kid_id = p_kid_id
    where q.age_group = v_group and q.active = true
    order by q.position asc
  ) loop
    if v_rec.completed_at is not null then
      v_status := 'done';
      v_prev_done := true;
    elsif v_prev_done then
      v_status := 'open';
      v_prev_done := false;
    else
      v_status := 'locked';
      v_prev_done := false;
    end if;

    v_arr := v_arr || jsonb_build_array(
      jsonb_build_object(
        'id', v_rec.id,
        'slug', v_rec.slug,
        'title', v_rec.title,
        'summary', v_rec.summary,
        'icon', v_rec.icon,
        'points', v_rec.points,
        'position', v_rec.position,
        'questionCount', v_rec.question_count,
        'status', v_status,
        'completedAt', v_rec.completed_at,
        'bestCorrect', v_rec.best_correct
      )
    );
  end loop;

  return jsonb_build_object(
    'ageGroup', v_group,
    'quests', v_arr
  );
end;
$$;

revoke all on function public.kid_quest_board(uuid) from public, anon, authenticated;
grant execute on function public.kid_quest_board(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Function: kid_quest_start
-- Validates eligibility, creates attempt, returns questions WITHOUT correct answers
-- ---------------------------------------------------------------------------
create or replace function public.kid_quest_start(p_kid_id uuid, p_quest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kid record;
  v_quest record;
  v_prev_id uuid;
  v_q_count int;
  v_attempt_id uuid;
  v_questions jsonb;
begin
  select id into v_kid from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_quest from public.quests where id = p_quest_id and active = true;
  if not found then
    raise exception 'not_found';
  end if;

  if v_quest.age_group <> public.kid_age_group(p_kid_id) then
    raise exception 'not_found';
  end if;

  -- Check if quest is unlocked
  if v_quest.position > 1 then
    select id into v_prev_id
    from public.quests
    where age_group = v_quest.age_group and active = true and position < v_quest.position
    order by position desc
    limit 1;

    if v_prev_id is not null then
      if not exists (select 1 from public.quest_completions where kid_id = p_kid_id and quest_id = v_prev_id) then
        raise exception 'quest_locked';
      end if;
    end if;
  end if;

  select count(*)::int into v_q_count
  from public.quest_questions
  where quest_id = p_quest_id;

  if v_q_count = 0 then
    raise exception 'not_found';
  end if;

  insert into public.quest_attempts (kid_id, quest_id, total, answers, correct_count)
  values (p_kid_id, p_quest_id, v_q_count, '{}'::jsonb, 0)
  returning id into v_attempt_id;

  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'position', position,
      'prompt', prompt,
      'choices', choices
    ) order by position asc
  ) into v_questions
  from public.quest_questions
  where quest_id = p_quest_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'quest', jsonb_build_object(
      'title', v_quest.title,
      'points', v_quest.points
    ),
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.kid_quest_start(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kid_quest_start(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Function: kid_quest_answer
-- Records an answer, validates choice, calculates completion & awards points once
-- ---------------------------------------------------------------------------
create or replace function public.kid_quest_answer(
  p_kid_id uuid,
  p_attempt_id uuid,
  p_question_id uuid,
  p_choice int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kid record;
  v_attempt record;
  v_q record;
  v_quest record;
  v_is_correct boolean;
  v_new_answers jsonb;
  v_new_correct int;
  v_answered_count int;
  v_done boolean;
  v_passed boolean := false;
  v_first_completion boolean := false;
  v_points_awarded int := 0;
  v_new_xp int;
  v_new_level int;
  v_comp_exists boolean;
  v_res jsonb;
begin
  -- 1. Lock kid, then attempt
  select * into v_kid from public.kids where id = p_kid_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_attempt from public.quest_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  -- 2. Kid ownership
  if v_attempt.kid_id <> p_kid_id then
    raise exception 'not_found';
  end if;

  -- 3. Attempt finished
  if v_attempt.finished_at is not null then
    raise exception 'attempt_finished';
  end if;

  -- 4. Question belonging
  select * into v_q from public.quest_questions where id = p_question_id;
  if not found or v_q.quest_id <> v_attempt.quest_id then
    raise exception 'not_found';
  end if;

  -- 5. Already answered
  if v_attempt.answers ? p_question_id::text then
    raise exception 'already_answered';
  end if;

  -- 6. Choice bounds
  if p_choice < 0 or p_choice >= jsonb_array_length(v_q.choices) then
    raise exception 'invalid_choice';
  end if;

  v_is_correct := (p_choice = v_q.correct_index);
  v_new_answers := v_attempt.answers || jsonb_build_object(p_question_id::text, p_choice);
  v_new_correct := v_attempt.correct_count + (case when v_is_correct then 1 else 0 end);
  v_answered_count := (select count(*)::int from jsonb_object_keys(v_new_answers));
  v_done := (v_answered_count >= v_attempt.total);

  if v_done then
    v_passed := (v_new_correct * 100 >= v_attempt.total * 60);

    update public.quest_attempts
    set answers = v_new_answers,
        correct_count = v_new_correct,
        finished_at = now(),
        passed = v_passed
    where id = v_attempt.id;

    select * into v_quest from public.quests where id = v_attempt.quest_id;

    if v_passed then
      select exists (
        select 1 from public.quest_completions
        where kid_id = p_kid_id and quest_id = v_attempt.quest_id
      ) into v_comp_exists;

      if not v_comp_exists then
        -- First time passing: award points and XP
        insert into public.quest_completions (kid_id, quest_id, points_awarded, best_correct)
        values (p_kid_id, v_attempt.quest_id, v_quest.points, v_new_correct);

        v_new_xp := coalesce(v_kid.xp, 0) + (5 * v_new_correct);
        v_new_level := coalesce(v_kid.level, 1);
        while v_new_xp >= 100 loop
          v_new_xp := v_new_xp - 100;
          v_new_level := v_new_level + 1;
        end loop;

        update public.kids
        set coins = coins + v_quest.points,
            xp = v_new_xp,
            level = v_new_level
        where id = p_kid_id;

        insert into public.kid_notifications (kid_id, kind, message, link)
        values (
          p_kid_id,
          'REWARD',
          'Quest complete: ' || v_quest.title || '. +' || v_quest.points || ' points',
          '/kid/missions'
        );

        v_first_completion := true;
        v_points_awarded := v_quest.points;
      else
        -- Repeat pass: practice only, update best_correct
        update public.quest_completions
        set best_correct = greatest(best_correct, v_new_correct)
        where kid_id = p_kid_id and quest_id = v_attempt.quest_id;

        v_first_completion := false;
        v_points_awarded := 0;
      end if;
    end if;
  else
    update public.quest_attempts
    set answers = v_new_answers,
        correct_count = v_new_correct
    where id = v_attempt.id;
  end if;

  v_res := jsonb_build_object(
    'correct', v_is_correct,
    'correctIndex', v_q.correct_index,
    'explanation', v_q.explanation,
    'done', v_done,
    'correctCount', v_new_correct,
    'total', v_attempt.total
  );

  if v_done then
    v_res := v_res || jsonb_build_object(
      'passed', v_passed,
      'pointsAwarded', v_points_awarded,
      'firstCompletion', v_first_completion
    );
  end if;

  return v_res;
end;
$$;

revoke all on function public.kid_quest_answer(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.kid_quest_answer(uuid, uuid, uuid, int) to service_role;
