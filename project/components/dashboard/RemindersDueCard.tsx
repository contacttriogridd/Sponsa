'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useDrawerDataChanged } from '@/lib/drawer-store';
import { remindersPendingToday } from '@/lib/upcoming-sponsorships';
import { loadUpcomingEvents } from '@/lib/upcoming-sponsorships-store';

/** Dashboard: how many D-3 / D-2 / D-1 reminders are due today and not sent yet. */
export function RemindersDueCard() {
  const [due, setDue] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState(0);
  const load = useCallback(() => {
    loadUpcomingEvents().then(({ events }) => { setDue(remindersPendingToday(events).length); setUpcoming(events.length); }).catch(() => setDue(0));
  }, []);
  useEffect(() => { load(); }, [load]);
  useDrawerDataChanged(load);

  return (
    <Link href="/sponsorships?tab=pending" className="block">
      <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
        <div className={due ? 'h-10 w-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center' : 'h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center'}>
          <BellRing className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Reminders due today: {due ?? '…'}</div>
          <div className="text-xs text-muted-foreground">{upcoming} sponsor event{upcoming === 1 ? '' : 's'} in the next 3 days · நினைவூட்டல்கள்</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}
