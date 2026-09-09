-- ============================================================
-- Migration: Feature updates
-- 1. Ensure session_token column + index exist
-- 2. Ensure invest_frequency column exists
-- 3. Ensure username is unique across all kids
-- 4. Add quiz_total_correct for rewards gate (3 plays minimum)
-- ============================================================

-- 1. session_token (safe to re-run)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS session_token text;
CREATE INDEX IF NOT EXISTS kids_session_token_idx ON public.kids(session_token);

-- 2. invest_frequency (kid-controlled)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_frequency text DEFAULT 'daily';

-- 3. risk_appetite (kid-controlled)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS risk_appetite text DEFAULT 'low';

-- 4. invest_last_paid (used by invest-settle)
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS invest_last_paid timestamptz;

-- 5. Unique username constraint (global across all kids)
--    Use a partial unique index so NULL usernames are allowed
CREATE UNIQUE INDEX IF NOT EXISTS kids_username_unique_idx
  ON public.kids(username)
  WHERE username IS NOT NULL;

-- 6. quiz_total_correct — lifetime correct answers, used for rewards gate
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS quiz_total_correct int NOT NULL DEFAULT 0;

-- Backfill quiz_total_correct from quiz_attempts for existing kids
UPDATE public.kids k
SET quiz_total_correct = (
  SELECT COUNT(*) FROM public.quiz_attempts qa
  WHERE qa.kid_id = k.id AND qa.correct = true
)
WHERE quiz_total_correct = 0;

-- 7. Trigger to keep quiz_total_correct in sync when a correct attempt is inserted
CREATE OR REPLACE FUNCTION increment_quiz_total_correct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.correct = true THEN
    UPDATE public.kids SET quiz_total_correct = quiz_total_correct + 1 WHERE id = NEW.kid_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_total_correct ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_total_correct
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION increment_quiz_total_correct();

-- 8. signature_data_url + signed_at on loans (for PDF export)
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS signature_data_url text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS signed_at timestamptz;
