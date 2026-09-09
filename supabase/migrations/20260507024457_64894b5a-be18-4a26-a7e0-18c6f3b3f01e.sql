
CREATE POLICY "parent inserts tx" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids k WHERE k.id = transactions.kid_id AND k.parent_id = auth.uid()));
