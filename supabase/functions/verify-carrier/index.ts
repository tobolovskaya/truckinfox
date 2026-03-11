import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BRREG_API = 'https://data.brreg.no/enhetsregisteret/api/enheter';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Validate input ---
    const { orgNumber } = await req.json() as { orgNumber?: string };
    if (!orgNumber || typeof orgNumber !== 'string') {
      return new Response(JSON.stringify({ error: 'orgNumber is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Norwegian org numbers are exactly 9 digits
    const normalised = orgNumber.replace(/\s/g, '');
    if (!/^\d{9}$/.test(normalised)) {
      return new Response(
        JSON.stringify({ error: 'Organisasjonsnummeret må være 9 siffer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Check that the caller is a carrier ---
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_type, is_verified, brreg_org_number')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile.user_type !== 'carrier') {
      return new Response(
        JSON.stringify({ error: 'Only carriers can verify their business' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.is_verified) {
      return new Response(
        JSON.stringify({ error: 'Already verified', alreadyVerified: true }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Check org number is not claimed by another carrier ---
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('brreg_org_number', normalised)
      .neq('id', user.id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Dette organisasjonsnummeret er allerede registrert' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Look up org in Brønnøysundregistrene ---
    const brregRes = await fetch(`${BRREG_API}/${normalised}`, {
      headers: { Accept: 'application/json' },
    });

    if (brregRes.status === 404) {
      return new Response(
        JSON.stringify({ error: 'Organisasjonsnummeret finnes ikke i Brønnøysundregistrene' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brregRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Kunne ikke kontakte Brønnøysundregistrene, prøv igjen' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entity = await brregRes.json();

    // Reject dissolved or bankrupt companies
    if (entity.slettedato) {
      return new Response(
        JSON.stringify({ error: 'Denne enheten er slettet fra registeret' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (entity.konkurs === true) {
      return new Response(
        JSON.stringify({ error: 'Denne enheten er registrert som konkurs' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (entity.underAvvikling === true || entity.underTvangsavviklingEllerTvangsopplosning === true) {
      return new Response(
        JSON.stringify({ error: 'Denne enheten er under avvikling' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyName: string = entity.navn ?? '';

    // --- Mark as verified (service role bypasses RLS) ---
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_verified: true,
        brreg_org_number: normalised,
        verified_at: new Date().toISOString(),
        // Optionally sync company name if not already set
        ...(companyName ? { company_name: companyName } : {}),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      return new Response(JSON.stringify({ error: 'Intern feil, prøv igjen' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, companyName }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('verify-carrier error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
