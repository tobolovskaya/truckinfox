import { getCorsHeaders } from '../_shared/cors.ts';

declare const Deno: {
  serve: (_handler: (_request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (_key: string) => string | undefined;
  };
};

type VippsPaymentRequest = {
  escrow_payment_id?: string;
  amount?: number;
  order_id?: string;
  customer_phone?: string;
  description?: string;
  customer_name?: string;
  carrier_name?: string;
};

Deno.serve(async (request: Request) => {
  const corsHeaders = getCorsHeaders(request, 'idempotency-key');
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    const payload = (await request.json()) as VippsPaymentRequest;

    const escrowPaymentId =
      typeof payload.escrow_payment_id === 'string' ? payload.escrow_payment_id : '';
    const orderId = typeof payload.order_id === 'string' ? payload.order_id : '';
    const amount = typeof payload.amount === 'number' ? payload.amount : Number.NaN;
    const customerPhone =
      typeof payload.customer_phone === 'string' ? payload.customer_phone.trim() : '';

    if (!escrowPaymentId || !orderId || !Number.isFinite(amount) || amount <= 0 || !customerPhone) {
      return json(400, {
        error:
          'Invalid payload. Required fields: escrow_payment_id, order_id, amount (>0), customer_phone.',
      });
    }

    // Use escrowPaymentId as fallback so each unique payment attempt has a stable idempotency key.
    const idempotencyKey = request.headers.get('Idempotency-Key') || escrowPaymentId;
    // Default is FALSE — mock mode must be explicitly opted into via VIPPS_MOCK_MODE=true.
    // This prevents silent mock payments in production if the env var is not set.
    const useMockMode = (Deno.env.get('VIPPS_MOCK_MODE') || 'false').toLowerCase() === 'true';

    if (useMockMode) {
      return json(200, {
        ok: true,
        mode: 'mock',
        provider: 'vipps',
        escrow_payment_id: escrowPaymentId,
        order_id: orderId,
        provider_order_id: `mock_${escrowPaymentId}`,
        payment_url: `https://app.vipps.no/pay/mock/${escrowPaymentId}?idempotency=${encodeURIComponent(idempotencyKey)}`,
        vipps_url: `https://app.vipps.no/pay/mock/${escrowPaymentId}?idempotency=${encodeURIComponent(idempotencyKey)}`,
        message:
          'Vipps mock payment URL generated. Set VIPPS_MOCK_MODE=false and configure real Vipps credentials for production.',
      });
    }

    // ── Real Vipps ePayment API ───────────────────────────────────────────────
    const clientId             = Deno.env.get('VIPPS_CLIENT_ID')             ?? '';
    const clientSecret         = Deno.env.get('VIPPS_CLIENT_SECRET')         ?? '';
    const subscriptionKey      = Deno.env.get('VIPPS_SUBSCRIPTION_KEY')      ?? '';
    const merchantSerialNumber = Deno.env.get('VIPPS_MERCHANT_SERIAL_NUMBER') ?? '';
    const systemName           = Deno.env.get('VIPPS_SYSTEM_NAME')           ?? 'TruckinFox';
    const systemVersion        = Deno.env.get('VIPPS_SYSTEM_VERSION')        ?? '1.0.0';
    const pluginName           = Deno.env.get('VIPPS_PLUGIN_NAME')           ?? 'truckinfox-supabase';
    const pluginVersion        = Deno.env.get('VIPPS_PLUGIN_VERSION')        ?? '1.0.0';
    // Use apitest.vipps.no for staging; api.vipps.no for production.
    const apiBase              = Deno.env.get('VIPPS_API_BASE_URL')          ?? 'https://api.vipps.no';
    const returnUrl            = Deno.env.get('VIPPS_RETURN_URL')            ?? 'truckinfox://payment-complete';

    if (!clientId || !clientSecret || !subscriptionKey || !merchantSerialNumber) {
      return json(503, {
        error: 'Vipps credentials are not configured. Set VIPPS_CLIENT_ID, VIPPS_CLIENT_SECRET, VIPPS_SUBSCRIPTION_KEY and VIPPS_MERCHANT_SERIAL_NUMBER in EAS environment variables.',
      });
    }

    // Step 1 — obtain access token
    const commonHeaders = {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Merchant-Serial-Number': merchantSerialNumber,
      'Vipps-System-Name': systemName,
      'Vipps-System-Version': systemVersion,
      'Vipps-System-Plugin-Name': pluginName,
      'Vipps-System-Plugin-Version': pluginVersion,
    };

    const tokenRes = await fetch(`${apiBase}/accesstoken/get`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json',
        'client_id': clientId,
        'client_secret': clientSecret,
      },
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      throw new Error(`Vipps token request failed (${tokenRes.status}): ${tokenErr}`);
    }

    const { access_token: accessToken } = await tokenRes.json() as { access_token: string };

    // Step 2 — create payment (amount in øre = NOK × 100)
    const amountInOre = Math.round(amount * 100);
    const paymentRes = await fetch(`${apiBase}/epayment/v1/payments`, {
      method: 'POST',
      headers: {
        ...commonHeaders,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: { currency: 'NOK', value: amountInOre },
        paymentMethod: { type: 'WALLET' },
        customer: { phoneNumber: customerPhone },
        // reference must be unique per merchant; use orderId (max 50 chars, alphanumeric + dash/underscore)
        reference: orderId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50),
        userFlow: 'PUSH_MESSAGE',
        returnUrl: `${returnUrl}/${orderId}`,
        paymentDescription: payload.description || `TruckinFox payment for order ${orderId}`,
      }),
    });

    if (!paymentRes.ok) {
      const paymentErr = await paymentRes.text();
      throw new Error(`Vipps payment creation failed (${paymentRes.status}): ${paymentErr}`);
    }

    const paymentData = await paymentRes.json() as { reference: string; redirectUrl?: string };

    return json(200, {
      ok: true,
      mode: 'live',
      provider: 'vipps',
      escrow_payment_id: escrowPaymentId,
      order_id: orderId,
      provider_order_id: paymentData.reference,
      payment_url: paymentData.redirectUrl ?? null,
      vipps_url: paymentData.redirectUrl ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return json(500, { error: 'Failed to initiate Vipps payment.', message });
  }
});
