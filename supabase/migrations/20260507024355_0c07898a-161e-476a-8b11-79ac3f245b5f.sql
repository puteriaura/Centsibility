
ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS invest_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invest_rate numeric NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS invest_last_paid timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS quiz_date date,
  ADD COLUMN IF NOT EXISTS quiz_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_wrong integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_decimal numeric NOT NULL DEFAULT 0;

ALTER TABLE public.kids
  ALTER COLUMN coins TYPE numeric USING coins::numeric,
  ALTER COLUMN unclaimed_coins TYPE numeric USING unclaimed_coins::numeric;
