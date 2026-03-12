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

    const { bidId } = await req.json();

    if (!bidId) {
      return new Response(JSON.stringify({ error: 'bidId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the bid
    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('id, request_id, carrier_id, price, status')
      .eq('id', bidId)
      .single();

    if (bidError || !bid) {
      return new Response(JSON.stringify({ error: 'Bid not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bid.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Bid is not pending (current status: ${bid.status})` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch the cargo request to verify ownership
    const { data: cargoRequest, error: requestError } = await supabaseAdmin
      .from('cargo_requests')
      .select('id, customer_id, status')
      .eq('id', bid.request_id)
      .single();

    if (requestError || !cargoRequest) {
      return new Response(JSON.stringify({ error: 'Cargo request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only the cargo request owner can accept a bid
    if (cargoRequest.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['open', 'bidding'].includes(cargoRequest.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot accept bid: request status is '${cargoRequest.status}'` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date().toISOString();

    // Atomically: reject all other pending bids for this request
    const { error: rejectError } = await supabaseAdmin
      .from('bids')
      .update({ status: 'rejected', updated_at: now })
      .eq('request_id', bid.request_id)
      .eq('status', 'pending')
      .neq('id', bidId);

    if (rejectError) {
      throw new Error(`Failed to reject other bids: ${rejectError.message}`);
    }

    // Accept the chosen bid
    const { error: acceptError } = await supabaseAdmin
      .from('bids')
      .update({ status: 'accepted', updated_at: now })
      .eq('id', bidId);

    if (acceptError) {
      throw new Error(`Failed to accept bid: ${acceptError.message}`);
    }

    // Update cargo request to 'assigned'
    const { error: requestUpdateError } = await supabaseAdmin
      .from('cargo_requests')
      .update({ status: 'assigned', updated_at: now })
      .eq('id', bid.request_id);

    if (requestUpdateError) {
      throw new Error(`Failed to update cargo request: ${requestUpdateError.message}`);
    }

    // Calculate platform fee (10%) and carrier payout
    const platformFee = Math.round(bid.price * 0.1 * 100) / 100;
    const carrierAmount = Math.round((bid.price - platformFee) * 100) / 100;

    // The DB trigger may have already created a provisional order on bid INSERT.
    // Update it if it exists; otherwise insert fresh to avoid duplicate rows.
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('bid_id', bidId)
      .maybeSingle();

    let order: { id: string };

    if (existingOrder) {
      const { data: updated, error: orderError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'pending',
          payment_status: 'pending',
          total_amount: bid.price,
          carrier_amount: carrierAmount,
          platform_fee: platformFee,
          updated_at: now,
        })
        .eq('id', existingOrder.id)
        .select('id')
        .single();

      if (orderError) {
        throw new Error(`Failed to update order: ${orderError.message}`);
      }
      order = updated;
    } else {
      const { data: created, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          request_id: bid.request_id,
          customer_id: cargoRequest.customer_id,
          carrier_id: bid.carrier_id,
          bid_id: bidId,
          status: 'pending',
          payment_status: 'pending',
          total_amount: bid.price,
          carrier_amount: carrierAmount,
          platform_fee: platformFee,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }
      order = created;
    }

    // Notify the carrier that their bid was accepted
    await supabaseAdmin.from('notifications').insert({
      user_id: bid.carrier_id,
      type: 'bid_accepted',
      title: 'Bid Accepted',
      body: `Your bid of ${bid.price} NOK has been accepted!`,
      related_id: order.id,
      related_type: 'order',
      read: false,
    });

    return new Response(
      JSON.stringify({ success: true, orderId: order.id, bidId, message: 'Bid accepted successfully' }),
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
