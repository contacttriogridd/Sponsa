'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { openMonthlySponsorDrawer, openSponsorDrawer } from '@/lib/drawer-store';
import type { ReminderItem } from '@/lib/today-reminders';

const UPCOMING_WINDOW = 30;
const dateLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function when(days: number): string {
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

function Row({ item, muted }: { item: ReminderItem; muted?: boolean }) {
  const open = () => {
    if (item.sponsor) openSponsorDrawer(item.sponsor.id, { occasionId: item.occasionRecord?.id });
    else if (item.monthlySponsor) openMonthlySponsorDrawer(item.monthlySponsor.id);
  };
  return (
    <button type="button" onClick={open} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors ${muted ? 'opacity-70' : ''}`}>
      <span className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">{item.icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium truncate">{item.occasion}</span>
        <span className="block text-sm text-muted-foreground truncate">{item.subtitle || `Sponsor: ${item.name}`} · {dateLabel(item.date)} · {when(item.days)}</span>
      </span>
    </button>
  );
}

/** Upcoming and recently past reminders; today's are shown above in Today's Reminders. */
export function UpcomingPastCards({ items }: { items: ReminderItem[] }) {
  const upcoming = items.filter((i) => i.group === 'upcoming' && i.days <= UPCOMING_WINDOW);
  const past = items.filter((i) => i.group === 'past' && i.days >= -7).sort((a, b) => b.days - a.days);
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold">Upcoming</h2>
            <p className="text-sm text-muted-foreground mt-1">Next {UPCOMING_WINDOW} days.</p>
          </div>
          <Link href="/reminders" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="space-y-3">
          {upcoming.slice(0, 5).map((i) => <Row key={i.key} item={i} />)}
          {upcoming.length === 0 && <div className="py-8 text-center text-muted-foreground">Nothing coming up.</div>}
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-5">
          <h2 className="font-semibold">Past</h2>
          <p className="text-sm text-muted-foreground mt-1">The last 7 days.</p>
        </div>
        <div className="space-y-3">
          {past.slice(0, 5).map((i) => <Row key={i.key} item={i} muted />)}
          {past.length === 0 && <div className="py-4 text-center text-muted-foreground">Nothing in the last 7 days.</div>}
        </div>
      </Card>
    </div>
  );
}
