'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { useDrawerDataChanged } from '@/lib/drawer-store';
import { formatStarDate } from '@/lib/monthly-sponsors';
import { STAGES, remindersSentByEvent, type ReminderRow } from '@/lib/upcoming-sponsorships';
import { ReminderChip } from '@/components/sponsorships/UpcomingSponsorships';
import type { SpecialOccasion } from '@/lib/types';

/** What a reminder's event_key refers to, in words. */
function eventLabel(key: string, occasions: SpecialOccasion[]): string {
  if (key.startsWith('occ:')) {
    const o = occasions.find((x) => x.id === key.slice(4));
    return o ? (o.occasion_name_en || `${o.person_name} – ${o.occasion_type}`) : 'Occasion';
  }
  if (key.startsWith('dob:')) return 'Birthday';
  if (key.startsWith('fam:')) return 'Family birthday';
  if (key.startsWith('req:')) return 'Sponsorship day';
  if (key.startsWith('mspay:')) return 'Monthly donation day';
  return 'Event';
}

/** Sponsor page: the D-3 / D-2 / D-1 reminders sent for each of this sponsor's events. */
export function SponsorReminderHistory({ sponsorId, occasions }: { sponsorId: string; occasions: SpecialOccasion[] }) {
  const [rows, setRows] = useState<ReminderRow[] | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('sponsorship_reminders').select('*').eq('sponsor_id', sponsorId).order('event_date', { ascending: false });
    setRows(error ? [] : (data || []) as ReminderRow[]);
  }, [sponsorId]);
  useEffect(() => { load(); }, [load]);
  useDrawerDataChanged(load);

  if (rows === null) return <div className="h-16 rounded-xl bg-muted animate-pulse" />;
  const events = remindersSentByEvent(rows);
  if (!events.length) return <Card className="p-6 text-center text-sm text-muted-foreground">No reminders sent yet. Reminders sent 3, 2 or 1 day before an event show here.</Card>;
  return (
    <div className="grid gap-2">
      {events.map((e) => (
        <Card key={`${e.key}|${e.date}`} className="p-3">
          <div className="text-sm"><span className="font-medium">{eventLabel(e.key, occasions)}</span> <span className="text-muted-foreground">· {formatStarDate(e.date)}</span></div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {STAGES.map((st) => {
              const sent = e.rows.find((r) => r.stage === st) || null;
              return <ReminderChip key={st} slot={{ stage: st, due: '', state: sent ? 'sent' : e.date < new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10) ? 'missed' : 'pending', sent }} />;
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
