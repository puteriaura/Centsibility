
-- Parent quick PIN
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin text;

-- Loan signature & metadata
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS signature_data_url text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS signed_at timestamptz;

-- Quiz attempt history
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL,
  question_index integer NOT NULL,
  question_text text NOT NULL,
  correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent reads quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (EXISTS (SELECT 1 FROM kids k WHERE k.id = kid_id AND k.parent_id = auth.uid()));

-- Parent notifications (approvals/rewards/loan requests)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  kid_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent rw notifications" ON public.notifications
  FOR ALL USING (auth.uid() = parent_id) WITH CHECK (auth.uid() = parent_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
