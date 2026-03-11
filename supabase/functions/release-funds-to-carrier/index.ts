import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the calling user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the order and validate it belongs to the requesting customer
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, carrier_id, status, payment_status, carrier_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only the customer can trigger fund release
    if (order.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Order must be in DELIVERED status
    if (order.status !== 'delivered' && order.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: `Cannot release funds: order status is '${order.status}'` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Prevent double release
    if (order.payment_status === 'released') {
      return new Response(
        JSON.stringify({ message: 'Funds already released', orderId }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark payment as released and complete order
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'released',
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // Create notification for carrier
    await supabaseAdmin.from('notifications').insert({
      user_id: order.carrier_id,
      type: 'payment_success',
      title: 'Payment Released',
      body: `Payment of ${order.carrier_amount} NOK has been released to your account.`,
      related_id: orderId,
      related_type: 'order',
      read: false,
    });

    return new Response(
      JSON.stringify({ success: true, orderId, message: 'Funds released to carrier' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
