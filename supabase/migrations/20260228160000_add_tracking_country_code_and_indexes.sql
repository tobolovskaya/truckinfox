ALTER TABLE public.tracking
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);

UPDATE public.tracking tr
SET country_code = COALESCE(
  (
    SELECT UPPER(cr.country_code)
    FROM public.cargo_requests cr
    WHERE cr.id = tr.request_id
  ),
  (
    SELECT UPPER(t.country_code)
    FROM public.trucks t
    WHERE t.id = tr.truck_id
  ),
  'NO'
)
WHERE tr.country_code IS NULL;

ALTER TABLE public.tracking
  ALTER COLUMN country_code SET DEFAULT 'NO';

UPDATE public.tracking
SET country_code = 'NO'
WHERE country_code IS NULL;

ALTER TABLE public.tracking
  ALTER COLUMN country_code SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_tracking_country_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  derived_country CHAR(2);
BEGIN
  IF NEW.request_id IS NOT NULL THEN
    SELECT UPPER(cr.country_code)::CHAR(2)
    INTO derived_country
    FROM public.cargo_requests cr
    WHERE cr.id = NEW.request_id;
  END IF;

  IF derived_country IS NULL THEN
    SELECT UPPER(t.country_code)::CHAR(2)
    INTO derived_country
    FROM public.trucks t
    WHERE t.id = NEW.truck_id;
  END IF;

  NEW.country_code := COALESCE(derived_country, 'NO');
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_tracking_country_code ON public.tracking;
CREATE TRIGGER trg_sync_tracking_country_code
  BEFORE INSERT OR UPDATE OF request_id, truck_id
  ON public.tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tracking_country_code();

CREATE INDEX IF NOT EXISTS idx_tracking_country_recorded
  ON public.tracking(country_code, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_country_request_recorded
  ON public.tracking(country_code, request_id, recorded_at DESC)
  WHERE request_id IS NOT NULL;
