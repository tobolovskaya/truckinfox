import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Auto-confirm deliveries that have been in 'delivered' status for 3+ days
 * without customer confirmation. This protects carriers from non-responsive customers.
 *
 * Triggered daily by pg_cron. Can also be invoked manually with service-role key.
 * Does NOT require user auth — runs entirely with service role.
 */
Deno.serve(async (req: Request) => {
  // Only allow internal invocation (from pg_cron via pg_net or manual with service role)
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!authHeader.includes(serviceRoleKey)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Find orders eligible for auto-confirmation
  const { data: orders, error: fetchError } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, carrier_id, carrier_amount')
    .eq('status', 'delivered')
    .lte('delivered_at', cutoff)
    .neq('payment_status', 'released');

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  if (!orders?.length) {
    return new Response(JSON.stringify({ confirmed: 0 }), { status: 200 });
  }

  const ids = orders.map(o => o.id);
  const now = new Date().toISOString();

  // Mark all as completed and funds released in one query
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'completed', payment_status: 'released', updated_at: now })
    .in('id', ids);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  // Notify both parties for every auto-confirmed order
  const notifications = orders.flatMap(order => [
    {
      user_id: order.customer_id,
      type: 'order_status_change',
      title: 'Delivery Auto-Confirmed',
      body: 'Your delivery was automatically confirmed after 3 days. If you have issues, please contact support.',
      data: { order_id: order.id, status: 'completed' },
      read: false,
    },
    {
      user_id: order.carrier_id,
      type: 'payment_success',
      title: 'Payment Released',
      body: `Payment of ${order.carrier_amount} NOK has been released after auto-confirmation.`,
      data: { order_id: order.id, status: 'completed' },
      read: false,
    },
  ]);

  await supabaseAdmin.from('notifications').insert(notifications);

  return new Response(
    JSON.stringify({ confirmed: orders.length, ids }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
