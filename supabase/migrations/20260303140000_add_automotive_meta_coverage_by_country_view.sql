CREATE OR REPLACE VIEW public.automotive_meta_coverage_by_country_v AS
SELECT
  COALESCE(country_code, '??') AS country_code,
  COUNT(*) FILTER (WHERE cargo_type = 'automotive')::bigint AS total_automotive_requests,
  COUNT(*) FILTER (
    WHERE cargo_type = 'automotive'
      AND automotive_meta IS NOT NULL
      AND automotive_meta <> '{}'::jsonb
  )::bigint AS with_automotive_meta,
  COUNT(*) FILTER (
    WHERE cargo_type = 'automotive'
      AND (automotive_meta IS NULL OR automotive_meta = '{}'::jsonb)
  )::bigint AS without_automotive_meta,
  COUNT(*) FILTER (
    WHERE cargo_type = 'automotive'
      AND description ~ '^\[automotive_condition\|[^\]]+\]'
  )::bigint AS legacy_tag_rows,
  ROUND(
    (
      COUNT(*) FILTER (
        WHERE cargo_type = 'automotive'
          AND automotive_meta IS NOT NULL
          AND automotive_meta <> '{}'::jsonb
      )::numeric
      / NULLIF(COUNT(*) FILTER (WHERE cargo_type = 'automotive'), 0)::numeric
    ) * 100,
    2
  ) AS coverage_percent
FROM public.cargo_requests
GROUP BY COALESCE(country_code, '??')
ORDER BY country_code;

GRANT SELECT ON public.automotive_meta_coverage_by_country_v TO authenticated;