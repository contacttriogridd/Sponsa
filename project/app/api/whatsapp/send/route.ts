import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText, whatsappApiConfig } from '@/lib/whatsapp-server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Verifies the caller is a signed-in admin/collector before allowing a send.
 * Without this, the route would be an open relay: anyone who can reach the
 * server could POST an arbitrary phone number + message and spend the
 * organization's WhatsApp API quota, bypassing the app and its consent checks.
 */
async function authorize(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { ok: false, status: 401, error: 'Not authenticated.' };

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { ok: false, status: 401, error: 'Not authenticated.' };

  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, active')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!appUser || !appUser.active || !['admin', 'collector'].includes(appUser.role)) {
    return { ok: false, status: 403, error: 'Not authorized to send WhatsApp messages.' };
  }

  return { ok: true };
}

/**
 * Server-only WhatsApp Cloud API sender. Credentials are read from
 * process.env here (never NEXT_PUBLIC_*) so the access token is never
 * shipped to the browser. Falls back to "not configured" instead of
 * throwing when the env vars are absent, so callers can save the message
 * as a draft.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!whatsappApiConfig()) return NextResponse.json({ configured: false });

  const { phone, message } = await request.json();
  if (!phone || !message || typeof phone !== 'string' || typeof message !== 'string') {
    return NextResponse.json({ error: 'Missing phone or message.' }, { status: 400 });
  }

  const result = await sendWhatsAppText(phone, message);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
