WITH source_rows AS (
  SELECT
    cr.id,
    LOWER((regexp_match(cr.description, '^\[automotive_condition\|([^\]]+)\]'))[1]) AS machine_payload
  FROM public.cargo_requests cr
  WHERE cr.cargo_type = 'automotive'
    AND cr.automotive_meta IS NULL
    AND cr.description IS NOT NULL
    AND cr.description ~ '^\[automotive_condition\|[^\]]+\]'
),
parsed_rows AS (
  SELECT
    s.id,
    LOWER(substring(s.machine_payload FROM 'driveable=([^|]+)')) AS driveable_raw,
    LOWER(substring(s.machine_payload FROM 'starts=([^|]+)')) AS starts_raw,
    LOWER(substring(s.machine_payload FROM 'damage=([^|]+)')) AS damage_raw
  FROM source_rows s
),
normalized_rows AS (
  SELECT
    p.id,
    CASE
      WHEN p.driveable_raw IN ('yes', 'ja', 'true', '1') THEN TRUE
      WHEN p.driveable_raw IN ('no', 'nei', 'false', '0') THEN FALSE
      ELSE NULL
    END AS driveable,
    CASE
      WHEN p.starts_raw IN ('yes', 'ja', 'true', '1') THEN TRUE
      WHEN p.starts_raw IN ('no', 'nei', 'false', '0') THEN FALSE
      ELSE NULL
    END AS starts,
    CASE
      WHEN p.damage_raw IN ('yes', 'ja', 'true', '1') THEN TRUE
      WHEN p.damage_raw IN ('no', 'nei', 'false', '0') THEN FALSE
      ELSE NULL
    END AS damage
  FROM parsed_rows p
)
UPDATE public.cargo_requests cr
SET
  automotive_meta = jsonb_strip_nulls(
    jsonb_build_object(
      'driveable', n.driveable,
      'starts', n.starts,
      'damage', n.damage
    )
  ),
  updated_at = NOW()
FROM normalized_rows n
WHERE cr.id = n.id
  AND (n.driveable IS NOT NULL OR n.starts IS NOT NULL OR n.damage IS NOT NULL);