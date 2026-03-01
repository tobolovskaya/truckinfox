const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  try {
    const payload = (await request.json()) as VippsPaymentRequest;

    const escrowPaymentId = typeof payload.escrow_payment_id === 'string' ? payload.escrow_payment_id : '';
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

    const idempotencyKey = request.headers.get('Idempotency-Key') || 'none';
    const useMockMode = (Deno.env.get('VIPPS_MOCK_MODE') || 'true').toLowerCase() !== 'false';

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

    return json(501, {
      error:
        'Real Vipps integration is not configured in this deployment. Set required Vipps secrets and implement provider API call.',
      details: {
        required_env: [
          'VIPPS_CLIENT_ID',
          'VIPPS_CLIENT_SECRET',
          'VIPPS_SUBSCRIPTION_KEY',
          'VIPPS_MERCHANT_SERIAL_NUMBER',
          'VIPPS_SYSTEM_NAME',
          'VIPPS_SYSTEM_VERSION',
          'VIPPS_PLUGIN_NAME',
          'VIPPS_PLUGIN_VERSION',
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return json(500, { error: 'Failed to initiate Vipps payment.', message });
  }
});
