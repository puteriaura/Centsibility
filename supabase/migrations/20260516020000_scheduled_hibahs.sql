CREATE TABLE scheduled_hibahs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kid_id UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies for scheduled_hibahs
ALTER TABLE scheduled_hibahs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage their scheduled hibahs" ON scheduled_hibahs
  FOR ALL
  TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());
