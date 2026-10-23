'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { SendWishButton } from '@/components/monthly/SendWishButton';
import { supabase } from '@/lib/supabase/client';
import { STARS } from '@/lib/natchathiram';
import { formatStarDate, todayIst, upcomingStarDays, whenLabel, type UpcomingStarDay } from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { openMonthlySponsorDrawer } from '@/lib/drawer-store';
import type { MonthlySponsor } from '@/lib/types';

/** Dashboard card: monthly sponsors whose star day falls in the next 7 days. */
export function StarDaysThisWeekCard() {
  const [items, setItems] = useState<UpcomingStarDay[] | null>(null);

  useEffect(() => {
    (async () => {
      const today = todayIst();
      const { data, error } = await supabase.from('monthly_sponsors').select('*').eq('status', 'active');
      if (error) { setItems([]); return; } // migration 00011 not applied yet
      const sponsors = (data || []) as MonthlySponsor[];
      if (!sponsors.some((s) => s.star != null)) { setItems([]); return; }
      const rows = await loadStarCalendar(addDays(today, -1), addDays(today, 6));
      setItems(upcomingStarDays(sponsors, rows, today, 7));
    })();
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold">Star days this week</h2>
          <p className="text-sm text-muted-foreground mt-1">நட்சத்திர நாட்கள் — monthly sponsors to wish.</p>
        </div>
        <Link href="/monthly-sponsors/star-calendar" className="text-sm text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-3">
        {(items || []).map((u) => (
          <div key={`${u.sponsor.id}-${u.occurrence.date}`} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">⭐</div>
            <div className="flex-1 min-w-0">
              <button type="button" onClick={() => openMonthlySponsorDrawer(u.sponsor.id)} className="font-medium truncate hover:text-primary text-left block max-w-full">{u.sponsor.name}</button>
              <div className="text-sm text-muted-foreground truncate">
                {STARS[u.sponsor.star!].ta} ({STARS[u.sponsor.star!].en}) · {formatStarDate(u.occurrence.date)} · {whenLabel(u.daysUntil)}
              </div>
            </div>
            <div className="hidden sm:block"><SendWishButton sponsor={u.sponsor} starDate={u.occurrence.date} /></div>
          </div>
        ))}
        {items && items.length === 0 && <div className="py-6 text-center text-muted-foreground">No star days this week.</div>}
        {!items && <div className="py-6 text-center text-muted-foreground">Loading…</div>}
      </div>
    </Card>
  );
}
