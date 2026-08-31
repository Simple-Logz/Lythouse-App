import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const origin = Deno.env.get('APP_ORIGIN') || 'https://sandbox-ai-app-eight.vercel.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Compatibility endpoint for older clients. The former implementation generated
 * random SHAs, random scan counts and fabricated findings. Production analysis
 * must come from process-validation, which reads the actual GitHub repository,
 * persists evidence and produces the canonical validation record.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Authentication required' }, 401);

    const body = await req.json().catch(() => ({}));
    const validationId = body.validation_id || body.validationId;
    if (!validationId) return json({ error: 'validation_id is required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, serviceKey);
    const { data: { user }, error: userError } = await db.auth.getUser(token);
    if (userError || !user) return json({ error: 'Invalid session' }, 401);

    const { data: validation } = await db.from('validations').select('id,workspace_id,project_id').eq('id', validationId).maybeSingle();
    if (!validation) return json({ error: 'Validation not found' }, 404);
    const { data: member } = await db.from('workspace_members').select('id').eq('workspace_id', validation.workspace_id).eq('user_id', user.id).maybeSingle();
    if (!member) return json({ error: 'Forbidden' }, 403);

    const response = await fetch(`${url}/functions/v1/process-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
      body: JSON.stringify({ validationId }),
    });
    const result = await response.json().catch(() => ({ error: 'Validation engine returned an invalid response' }));
    return json(result, response.status);
  } catch (error) {
    console.error('analyze-deployment compatibility error', error);
    return json({ error: error instanceof Error ? error.message : 'Analysis failed' }, 500);
  }
});
