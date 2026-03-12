-- =============================================================================
-- ТАБЛИЦЯ: disputes
-- Суперечки між замовниками та перевізниками по замовленнях.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  filed_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  reason        TEXT NOT NULL
                  CHECK (reason IN ('damage', 'not_delivered', 'wrong_item', 'payment', 'other')),
  description   TEXT NOT NULL,

  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),

  resolution    TEXT,
  resolved_by   UUID REFERENCES public.profiles(id),
  resolved_at   TIMESTAMPTZ,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON public.disputes(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status   ON public.disputes(status);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can view disputes"
  ON public.disputes FOR SELECT TO authenticated
  USING (
    filed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.customer_id = auth.uid() OR o.carrier_id = auth.uid())
    )
    OR public.is_admin()
  );

CREATE POLICY "Order participants can file disputes"
  ON public.disputes FOR INSERT TO authenticated
  WITH CHECK (
    filed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (o.customer_id = auth.uid() OR o.carrier_id = auth.uid())
        AND o.status NOT IN ('cancelled', 'canceled')
    )
  );

CREATE POLICY "Admins have full access to disputes"
  ON public.disputes FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
