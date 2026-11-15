'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ObservanceChip } from '@/components/monthly/ObservanceChip';
import { useAuth } from '@/lib/auth-context';
import { todayIst, whenLabel } from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { shortDay, type ObservanceView } from '@/lib/observances';
import { loadObservances } from '@/lib/observances-store';

/** Dashboard card: the next 3 monthly observances (Pradosham, Ekadashi, …). */
export function UpcomingObservancesCard() {
  const { appUser } = useAuth();
  const [items, setItems] = useState<ObservanceView[] | null>(null);
  const today = todayIst();

  const load = useCallback(() => {
    loadObservances(today, addDays(today, 60)).then((rows) => setItems(rows.slice(0, 3)));
  }, [today]);
  useEffect(() => { load(); }, [load]);

  const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Upcoming observances</h2>
          <p className="text-sm text-muted-foreground mt-1">விரத நாட்கள் — Amavasai, Pournami, Pradosham and more.</p>
        </div>
        <Link href="/monthly-sponsors/star-calendar" className="text-sm text-primary hover:underline">Calendar</Link>
      </div>
      <div className="space-y-2">
        {(items || []).map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-border">
            <span className="text-sm font-medium w-24 shrink-0">{shortDay(e.on)}</span>
            <ObservanceChip item={e} isAdmin={appUser?.role === 'admin'} onChanged={load} variant="row" />
            <span className="text-xs text-muted-foreground ml-auto">{whenLabel(daysUntil(e.on))}</span>
          </div>
        ))}
        {items && items.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No observance dates loaded. An admin can import them in <Link href="/settings/calendar" className="text-primary hover:underline">Settings → Calendar</Link>.
          </div>
        )}
        {!items && <div className="py-6 text-center text-muted-foreground">Loading…</div>}
      </div>
    </Card>
  );
}
