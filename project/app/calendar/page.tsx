'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Calendar, type CalendarEvent } from '@/components/calendar/CalendarView';
import { supabase } from '@/lib/supabase/client';
import type { Donation, MonthlySponsor, SpecialOccasion, Sponsor, SponsorshipRequest } from '@/lib/types';
import { getUpcomingOccasions } from '@/lib/date-utils';
import { getTodayIST } from '@/lib/dateHelpers';
import { monthlySponsorEvent, occasionEvent, occurrencesBetween, shiftDate, sponsorshipEvent } from '@/lib/recurrence';

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    (async () => {
      const [o, s, d, r, m] = await Promise.all([
        supabase.from('special_occasions').select('*'),
        supabase.from('sponsors').select('*'),
        supabase.from('donations').select('*'),
        supabase.from('sponsorship_requests').select('*').in('recurrence', ['daily', 'weekly', 'monthly', 'yearly']),
        supabase.from('monthly_sponsors').select('*').eq('status', 'active'),
      ]);
      const sponsors = (s.data || []) as Sponsor[];
      const activeIds = new Set(sponsors.filter((x) => x.status !== 'archived').map((x) => x.id));
      const today = getTodayIST();
      const from = shiftDate(today, -60);
      const to = shiftDate(today, 365);

      const occasions = (o.data || []) as SpecialOccasion[];
      const repeats = (x: SpecialOccasion) => ['daily', 'weekly', 'monthly'].includes(occasionEvent(x).recurrence || '');
      const occasionEvents: CalendarEvent[] = getUpcomingOccasions(occasions.filter((x) => !repeats(x)), sponsors, 365).map((x) => ({
        date: dateKey(x.nextDate),
        title: x.occasion.person_name,
        type: x.occasion.occasion_type.includes('Anniversary') ? 'anniversary' : 'birthday',
        sponsorId: x.sponsor.id,
      }));
      const repeating: CalendarEvent[] = occasions
        .filter((x) => repeats(x) && activeIds.has(x.sponsor_id))
        .flatMap((x) => occurrencesBetween(occasionEvent(x), from, to).map((date) => ({
          date, title: `🔁 ${x.person_name}`, type: 'other' as const, sponsorId: x.sponsor_id,
        })));
      const sponsorships: CalendarEvent[] = ((r.error ? [] : r.data || []) as SponsorshipRequest[])
        .filter((x) => activeIds.has(x.sponsor_id) && x.status !== 'declined' && x.status !== 'cancelled')
        .flatMap((x) => occurrencesBetween(sponsorshipEvent(x), from, to).map((date) => ({
          date, title: `🔁 ${x.occasion_name || 'Sponsorship'}`, type: 'other' as const, sponsorId: x.sponsor_id,
        })));
      const monthly: CalendarEvent[] = ((m.error ? [] : m.data || []) as MonthlySponsor[])
        .filter((x) => x.payment_day)
        .flatMap((x) => occurrencesBetween(monthlySponsorEvent(x), from, to).map((date) => ({
          date, title: `🔁 ${x.name}`, type: 'donation' as const,
        })));
      const donationEvents: CalendarEvent[] = ((d.data || []) as Donation[]).map((don) => ({
        date: don.donation_date, title: don.occasion_name || 'Donation', type: 'donation', sponsorId: don.sponsor_id,
      }));
      setEvents([...occasionEvents, ...repeating, ...sponsorships, ...monthly, ...donationEvents]);
    })();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Plan ahead</p>
          <h1 className="text-2xl font-semibold mt-1">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Birthdays, anniversaries, donations, and follow-ups in one view.</p>
        </div>
        <Calendar events={events} onEventClick={(e) => { if (e.sponsorId) router.push(`/sponsors/${e.sponsorId}`); }} />
      </div>
    </AppLayout>
  );
}
