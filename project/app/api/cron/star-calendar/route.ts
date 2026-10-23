import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addDays, computeStarCalendar, istDateKey } from '@/lib/star-calendar';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily job (Vercel Cron, see vercel.json) that recalculates the star at
 * Coimbatore sunrise for yesterday through the next 12 months and stores it
 * in star_calendar, so the app reads star days instead of computing them.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase service role is not configured on the server.' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const from = addDays(istDateKey(new Date()), -1);
  const rows = computeStarCalendar(from, 368).map((r) => ({ ...r, computed_at: new Date().toISOString() }));

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('star_calendar').upsert(rows.slice(i, i + 100));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ from, to: rows[rows.length - 1].date, days: rows.length });
}
