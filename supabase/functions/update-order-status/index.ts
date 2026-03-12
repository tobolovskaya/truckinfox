import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';

/**
 * Allowed status transitions per role.
 * Only the listed caller role may move from `from` → `to`.
 */
const ALLOWED_TRANSITIONS: {
  from: OrderStatus;
  to: OrderStatus;
  role: 'customer' | 'carrier' | 'both';
}[] = [
  // Customer cancels before payment
  { from: 'pending_payment', to: 'cancelled', role: 'customer' },
  // Carrier starts transit after payment
  { from: 'paid', to: 'in_progress', role: 'carrier' },
  // Carrier marks delivery done
  { from: 'in_progress', to: 'delivered', role: 'carrier' },
  // Either party can open a dispute while active
  { from: 'paid', to: 'disputed', role: 'both' },
  { from: 'in_progress', to: 'disputed', role: 'both' },
  { from: 'delivered', to: 'disputed', role: 'both' },
];

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { orderId, newStatus } = body as { orderId?: string; newStatus?: OrderStatus };

    if (!orderId || !newStatus) {
      return new Response(JSON.stringify({ error: 'orderId and newStatus are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id, carrier_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine caller identity against the order (primary authorization check)
    const isCustomer = order.customer_id === user.id;
    const isCarrier = order.carrier_id === user.id;

    if (!isCustomer && !isCarrier) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prefer role from JWT app_metadata (set by custom_access_token_hook, tamper-proof).
    // Fall back to inferring from order columns for sessions pre-dating the hook.
    const jwtRole = user.app_metadata?.user_type as string | undefined;
    const callerRole: 'customer' | 'carrier' =
      (jwtRole === 'customer' || jwtRole === 'carrier')
        ? jwtRole
        : isCustomer ? 'customer' : 'carrier';
    const currentStatus = order.status as OrderStatus;

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS.find(
      (t) =>
        t.from === currentStatus &&
        t.to === newStatus &&
        (t.role === 'both' || t.role === callerRole)
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: `Transition '${currentStatus}' → '${newStatus}' is not allowed for role '${callerRole}'`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply update
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // --- Send notification to the other party ---
    type NotificationRow = {
      user_id: string;
      type: string;
      title: string;
      body: string;
      data: Record<string, string>;
    };

    let notification: NotificationRow | null = null;
    const transition = `${currentStatus}->${newStatus}`;

    if (transition === 'paid->in_progress') {
      notification = {
        user_id: order.customer_id,
        type: 'order_status_change',
        title: 'Order Update',
        body: 'The carrier has started the delivery.',
        data: { order_id: orderId, status: newStatus },
      };
    } else if (transition === 'in_progress->delivered') {
      notification = {
        user_id: order.customer_id,
        type: 'order_status_change',
        title: 'Order Update',
        body: 'Your cargo has been delivered. Please confirm receipt.',
        data: { order_id: orderId, status: newStatus },
      };
    } else if (newStatus === 'disputed') {
      // Notify the other party, not the one who opened the dispute
      const notifyUserId = isCustomer ? order.carrier_id : order.customer_id;
      notification = {
        user_id: notifyUserId,
        type: 'order_status_change',
        title: 'Order Update',
        body: 'A dispute has been opened for this order.',
        data: { order_id: orderId, status: newStatus },
      };
    } else if (transition === 'pending_payment->cancelled') {
      notification = {
        user_id: order.carrier_id,
        type: 'order_status_change',
        title: 'Order Update',
        body: 'The order has been cancelled by the customer.',
        data: { order_id: orderId, status: newStatus },
      };
    }

    if (notification) {
      await supabaseAdmin.from('notifications').insert(notification);
    }

    return new Response(
      JSON.stringify({ success: true, orderId, status: newStatus }),
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
