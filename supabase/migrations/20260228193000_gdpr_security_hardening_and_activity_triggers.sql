-- =============================================================================
-- GDPR/Security hardening
-- 1) Remove permissive public-style reads on profiles/cargo_requests
-- 2) Make legacy trucks bucket private and restrict SELECT to owner/admin
-- 3) Add fn_insert_log + trigger helper for key activity_log events
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS hardening: profiles + cargo_requests
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Cargo requests are viewable by everyone" ON public.cargo_requests;
DROP POLICY IF EXISTS "Authenticated users can view cargo requests" ON public.cargo_requests;
CREATE POLICY "Authenticated users can view cargo requests"
  ON public.cargo_requests FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Storage hardening: trucks bucket private + owner/admin read
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'trucks';

DROP POLICY IF EXISTS "Public read trucks" ON storage.objects;
DROP POLICY IF EXISTS "Carriers read own truck images" ON storage.objects;
CREATE POLICY "Carriers read own truck images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trucks'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- -----------------------------------------------------------------------------
-- Activity log helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_insert_log(
  p_user_id    UUID,
  p_action     TEXT,
  p_table_name TEXT,
  p_row_id     UUID,
  p_details    JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.log_activity(
    p_user_id,
    p_action,
    p_table_name,
    p_row_id,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_insert_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      UUID;
  v_action       TEXT;
  v_table_name   TEXT;
  v_row_id_text  TEXT;
  v_row_id       UUID;
  v_details      JSONB;
  v_new_data     JSONB;
  v_old_data     JSONB;
BEGIN
  v_user_id := auth.uid();
  v_table_name := TG_TABLE_NAME;
  v_action := lower(TG_TABLE_NAME) || '.' || lower(TG_OP);

  v_new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;

  v_row_id_text := COALESCE(
    v_new_data ->> 'id',
    v_new_data ->> 'order_id',
    v_old_data ->> 'id',
    v_old_data ->> 'order_id'
  );

  BEGIN
    v_row_id := CASE WHEN v_row_id_text IS NULL OR v_row_id_text = '' THEN NULL ELSE v_row_id_text::uuid END;
  EXCEPTION
    WHEN OTHERS THEN
      v_row_id := NULL;
  END;

  v_details := jsonb_build_object(
    'operation', TG_OP,
    'table', TG_TABLE_NAME
  );

  IF (v_new_data ? 'status') OR (v_old_data ? 'status') THEN
    v_details := v_details || jsonb_build_object(
      'old_status', v_old_data ->> 'status',
      'new_status', v_new_data ->> 'status'
    );
  END IF;

  PERFORM public.fn_insert_log(v_user_id, v_action, v_table_name, v_row_id, v_details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_log_cargo_requests ON public.cargo_requests;
CREATE TRIGGER trg_activity_log_cargo_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.cargo_requests
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_bids ON public.bids;
CREATE TRIGGER trg_activity_log_bids
  AFTER INSERT OR UPDATE OR DELETE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_orders ON public.orders;
CREATE TRIGGER trg_activity_log_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_payments ON public.payments;
CREATE TRIGGER trg_activity_log_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_escrow_payments ON public.escrow_payments;
CREATE TRIGGER trg_activity_log_escrow_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.escrow_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();

DROP TRIGGER IF EXISTS trg_activity_log_deliveries ON public.deliveries;
CREATE TRIGGER trg_activity_log_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.fn_insert_log_trigger();
