'use client';

import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SendWishButton } from '@/components/monthly/SendWishButton';
import { supabase } from '@/lib/supabase/client';
import { STARS } from '@/lib/natchathiram';
import { formatCurrency } from '@/lib/constants';
import {
  DEFAULT_STAR_REMINDER_DAYS, formatIstTime, formatStarDate, monthKey, paymentsDue, shiftMonth, todayIst, upcomingStarDays, whenLabel,
  type PaymentDue, type UpcomingStarDay,
} from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { useStarWish } from '@/lib/star-wish';
import type { MonthlyPayment, MonthlySponsor } from '@/lib/types';

/**
 * Reminders page section: star days within the reminder window (default
 * 2 days) and monthly contributions due soon or overdue.
 */
export function MonthlySponsorReminders() {
  const [starDays, setStarDays] = useState<UpcomingStarDay[]>([]);
  const [dues, setDues] = useState<PaymentDue[]>([]);
  const buildWish = useStarWish();

  useEffect(() => {
    (async () => {
      const today = todayIst();
      const thisMonth = monthKey(today);
      const [{ data: org }, { data, error }, { data: payments }] = await Promise.all([
        supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
        supabase.from('monthly_sponsors').select('*').eq('status', 'active'),
        supabase.from('monthly_payments').select('*').in('month', [thisMonth, shiftMonth(thisMonth, 1)]),
      ]);
      if (error || !data?.length) return;
      const sponsors = data as MonthlySponsor[];
      const lead: number = org?.star_reminder_days ?? DEFAULT_STAR_REMINDER_DAYS;
      setDues(paymentsDue(sponsors, (payments || []) as MonthlyPayment[], today, lead));
      if (sponsors.some((s) => s.star != null)) {
        const rows = await loadStarCalendar(addDays(today, -1), addDays(today, lead));
        setStarDays(upcomingStarDays(sponsors, rows, today, lead + 1));
      }
    })();
  }, []);

  if (starDays.length === 0 && dues.length === 0) return null;

  return (
    <div className="grid gap-3">
      {starDays.map((u) => (
        <Card key={`star-${u.sponsor.id}-${u.occurrence.date}`} className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">⭐</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{u.sponsor.name}&apos;s star day</h3>
                <Badge variant={u.daysUntil <= 1 ? 'destructive' : 'secondary'}>{whenLabel(u.daysUntil)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{STARS[u.sponsor.star!].ta} ({STARS[u.sponsor.star!].en}) · {formatStarDate(u.occurrence.date)}</p>
              <p className="text-sm text-muted-foreground">Star from {formatIstTime(u.occurrence.start)} to {formatIstTime(u.occurrence.end)}</p>
            </div>
            <div className="hidden sm:flex gap-2">
              {u.sponsor.phone && <a href={`tel:${u.sponsor.phone}`}><Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button></a>}
              <SendWishButton href={buildWish(u.sponsor, u.occurrence.date).url} size="default" />
            </div>
          </div>
        </Card>
      ))}
      {dues.map((d) => (
        <Card key={`due-${d.sponsor.id}-${d.month}`} className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl">💰</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">Monthly payment due — {d.sponsor.name}</h3>
                <Badge variant={d.daysUntil <= 0 ? 'destructive' : 'secondary'}>{whenLabel(d.daysUntil)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {d.sponsor.monthly_amount != null ? `${formatCurrency(Number(d.sponsor.monthly_amount))} · ` : ''}due {formatStarDate(d.dueDate)}
              </p>
            </div>
            {d.sponsor.phone && (
              <a href={`tel:${d.sponsor.phone}`} className="hidden sm:block"><Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button></a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
