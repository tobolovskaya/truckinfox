import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Auth: verify caller ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate JWT with anon key to get user id
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const userId = user.id;

    // Admin client (service role) for destructive operations
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- 1. Delete storage files ---
    const storageBuckets = ['avatars', 'cargo', 'truck_images', 'chat_media'];
    for (const bucket of storageBuckets) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(userId, {
          limit: 1000,
          offset: 0,
        });
        if (files && files.length > 0) {
          const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
          await admin.storage.from(bucket).remove(paths);
        }
      } catch {
        // Non-fatal: bucket may not exist or user may have no files there
      }
    }

    // --- 2. Delete database rows (ordered to respect FK constraints) ---
    // Leaf tables first
    const simpleDeleteions: Array<{ table: string; column: string }> = [
      { table: 'typing_indicators', column: 'user_id' },
      { table: 'activity_log', column: 'user_id' },
      { table: 'user_favorites', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'reviews', column: 'reviewer_id' },
      { table: 'reviews', column: 'reviewee_id' },
      { table: 'messages', column: 'sender_id' },
    ];

    for (const { table, column } of simpleDeleteions) {
      await admin.from(table).delete().eq(column, userId);
    }

    // Delete chats by actual column names
    await admin.from('chats').delete().eq('user_a_id', userId);
    await admin.from('chats').delete().eq('user_b_id', userId);

    // Delete delivery_tracking via user's truck IDs
    const { data: userTrucksForTracking } = await admin
      .from('trucks')
      .select('id')
      .eq('carrier_id', userId);

    if (userTrucksForTracking && userTrucksForTracking.length > 0) {
      const truckIds = userTrucksForTracking.map((t: { id: string }) => t.id);
      await admin.from('delivery_tracking').delete().in('truck_id', truckIds);
    }

    // Delete escrow payments linked to user's orders
    const { data: userOrders } = await admin
      .from('orders')
      .select('id')
      .or(`customer_id.eq.${userId},carrier_id.eq.${userId}`);

    if (userOrders && userOrders.length > 0) {
      const orderIds = userOrders.map((o: { id: string }) => o.id);
      await admin.from('escrow_payments').delete().in('order_id', orderIds);
      await admin.from('payments').delete().in('order_id', orderIds);
      await admin.from('orders').delete().in('id', orderIds);
    }

    // Delete bids on user's requests and bids placed by user
    const { data: userRequests } = await admin
      .from('cargo_requests')
      .select('id')
      .eq('customer_id', userId);

    if (userRequests && userRequests.length > 0) {
      const requestIds = userRequests.map((r: { id: string }) => r.id);
      await admin.from('bids').delete().in('request_id', requestIds);
    }
    await admin.from('bids').delete().eq('carrier_id', userId);

    // Remaining cargo requests and trucks
    await admin.from('cargo_requests').delete().eq('customer_id', userId);
    await admin.from('trucks').delete().eq('carrier_id', userId);

    // Finally, the profile
    await admin.from('profiles').delete().eq('id', userId);

    // --- 3. Delete auth user ---
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError);
      return json({ error: 'Failed to delete account. Please contact support.' }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error('delete-account error:', err);
    return json({ error: 'An unexpected error occurred.' }, 500);
  }
});
