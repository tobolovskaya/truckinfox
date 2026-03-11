-- Custom Access Token Hook
-- Embeds `user_type` from profiles into JWT app_metadata on every token mint.
-- This makes the role tamper-proof (app_metadata is admin-only, unlike user_metadata)
-- and eliminates per-request DB lookups for role in Edge Functions and RLS policies.
--
-- After applying this migration, register the hook in:
--   Supabase Dashboard → Authentication → Hooks
--   Hook type: "Custom Access Token"
--   Function: public.custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_type_val text;
  claims        jsonb;
BEGIN
  -- Read user_type from profiles (source of truth)
  SELECT user_type
    INTO user_type_val
    FROM public.profiles
   WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_type_val IS NOT NULL THEN
    -- Stamp into app_metadata (admin-only, not user-editable)
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('user_type', user_type_val)
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Allow the auth service to call this function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public to prevent direct calls
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
