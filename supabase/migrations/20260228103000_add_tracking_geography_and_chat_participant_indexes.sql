DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping postgis extension create due to insufficient privilege';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geography') THEN
    ALTER TABLE public.tracking
      ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

    UPDATE public.tracking
    SET location = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
    WHERE location IS NULL;

    CREATE OR REPLACE FUNCTION public.sync_tracking_location()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location := ST_SetSRID(
          ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
          4326
        )::geography;
      ELSE
        NEW.location := NULL;
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_sync_tracking_location ON public.tracking;
    CREATE TRIGGER trg_sync_tracking_location
      BEFORE INSERT OR UPDATE OF latitude, longitude
      ON public.tracking
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_tracking_location();

    CREATE INDEX IF NOT EXISTS idx_tracking_location_gist
      ON public.tracking
      USING GIST(location);
  ELSE
    RAISE NOTICE 'Type geography is not available; skipping location column/index setup';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id
  ON public.chat_participants(chat_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_joined
  ON public.chat_participants(chat_id, joined_at DESC);
