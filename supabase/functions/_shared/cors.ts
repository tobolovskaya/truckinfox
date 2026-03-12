/**
 * Dynamic CORS helper for Supabase Edge Functions.
 *
 * Strategy:
 *   - Native mobile (no Origin header): CORS headers are irrelevant; browser
 *     enforcement does not apply. No Access-Control-Allow-Origin is returned.
 *   - Browser request from an allowed origin: the origin is reflected back.
 *   - Browser request from an unknown origin: no Allow-Origin header is set,
 *     so the browser blocks the request.
 *
 * Allowed origins are resolved at cold-start from the SUPABASE_URL env var
 * (automatically injected by Supabase) plus local Expo dev servers.
 */

const ALLOWED_ORIGINS = new Set<string>(
  [
    Deno.env.get('SUPABASE_URL') ?? '',   // e.g. https://xyz.supabase.co
    'http://localhost:8081',              // Expo Go / Metro bundler
    'http://localhost:19006',             // Expo Web
  ].filter(Boolean)
);

/**
 * Returns CORS headers for the given request.
 *
 * @param req              The incoming request (needed to read Origin header).
 * @param extraAllowHeaders  Optional comma-separated extra headers to allow
 *                           (e.g. 'idempotency-key').
 */
export function getCorsHeaders(
  req: Request,
  extraAllowHeaders?: string
): Record<string, string> {
  const allowHeaders = [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    ...(extraAllowHeaders ? [extraAllowHeaders] : []),
  ].join(', ');

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  const origin = req.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}
