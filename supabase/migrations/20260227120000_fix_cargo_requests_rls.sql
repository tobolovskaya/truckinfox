-- Ensure cargo_requests RLS policies match app ownership model (customer_id = auth.uid())

ALTER TABLE public.cargo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cargo requests are viewable by everyone" ON public.cargo_requests;
DROP POLICY IF EXISTS "Customers can create cargo requests" ON public.cargo_requests;
DROP POLICY IF EXISTS "Customers can update their cargo requests" ON public.cargo_requests;
DROP POLICY IF EXISTS "Customers can delete their cargo requests" ON public.cargo_requests;

CREATE POLICY "Cargo requests are viewable by everyone"
  ON public.cargo_requests FOR SELECT
  USING (true);

CREATE POLICY "Customers can create cargo requests"
  ON public.cargo_requests FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their cargo requests"
  ON public.cargo_requests FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their cargo requests"
  ON public.cargo_requests FOR DELETE
  USING (auth.uid() = customer_id);
