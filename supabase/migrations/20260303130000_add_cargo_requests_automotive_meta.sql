ALTER TABLE public.cargo_requests
ADD COLUMN IF NOT EXISTS automotive_meta JSONB;

COMMENT ON COLUMN public.cargo_requests.automotive_meta IS
'Structured automotive condition metadata: {"driveable": boolean, "starts": boolean, "damage": boolean}';