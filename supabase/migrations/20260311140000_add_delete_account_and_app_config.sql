-- ============================================================
-- app_config: key/value store for runtime configuration
-- Used for: forced update thresholds, feature flags, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Only service role can write; authenticated users can read
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_read_authenticated"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed: minimum supported app version (used for forced update prompt)
INSERT INTO public.app_config (key, value)
VALUES ('min_app_version', '"1.0.0"'::jsonb)
ON CONFLICT (key) DO NOTHING;
