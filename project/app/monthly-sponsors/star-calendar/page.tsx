'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Phone, Star } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SendWishButton } from '@/components/monthly/SendWishButton';
import { supabase } from '@/lib/supabase/client';
import { STARS, RAASIS, astroLabel } from '@/lib/natchathiram';
import { effectiveRaasi, formatIstTime, formatStarDate, todayIst, upcomingStarDays, whenLabel, type UpcomingStarDay } from '@/lib/monthly-sponsors';
import { addDays, type StarCalendarDay } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { openMonthlySponsorDrawer } from '@/lib/drawer-store';
import { cn } from '@/lib/utils';
import type { MonthlySponsor } from '@/lib/types';

const WEEKDAYS = [
  { ta: 'ஞாயிறு', en: 'Sun' }, { ta: 'திங்கள்', en: 'Mon' }, { ta: 'செவ்வாய்', en: 'Tue' }, { ta: 'புதன்', en: 'Wed' },
  { ta: 'வியாழன்', en: 'Thu' }, { ta: 'வெள்ளி', en: 'Fri' }, { ta: 'சனி', en: 'Sat' },
];

function monthTitle(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function StarCalendarPage() {
  const today = todayIst();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [sponsors, setSponsors] = useState<MonthlySponsor[]>([]);
  const [monthRows, setMonthRows] = useState<StarCalendarDay[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingStarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = addDays(first, daysInMonth - 1);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('monthly_sponsors').select('*').eq('status', 'active').order('name');
      const list = (data || []) as MonthlySponsor[];
      setSponsors(list);
      const rows = await loadStarCalendar(addDays(today, -1), addDays(today, 29));
      setUpcoming(upcomingStarDays(list, rows, today, 30));
    })();
  }, [today]);

  useEffect(() => {
    setLoading(true);
    loadStarCalendar(addDays(first, -1), last).then((rows) => { setMonthRows(rows); setLoading(false); });
  }, [first, last]);

  const rowByDate = useMemo(() => new Map(monthRows.map((r) => [r.date, r])), [monthRows]);
  const starDaysByDate = useMemo(() => {
    const map = new Map<string, UpcomingStarDay[]>();
    for (const u of upcomingStarDays(sponsors, monthRows, first, daysInMonth)) {
      if (!map.has(u.occurrence.date)) map.set(u.occurrence.date, []);
      map.get(u.occurrence.date)!.push(u);
    }
    return map;
  }, [sponsors, monthRows, first, daysInMonth]);

  const firstWeekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 0; d < daysInMonth; d++) cells.push(addDays(first, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear()); setMonth(d.getUTCMonth());
  };
  const goToday = () => { setYear(Number(today.slice(0, 4))); setMonth(Number(today.slice(5, 7)) - 1); };

  const selectedRow = selected ? rowByDate.get(selected) : undefined;
  const selectedSponsors = selected ? starDaysByDate.get(selected) || [] : [];

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link href="/monthly-sponsors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Monthly Sponsors
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">நட்சத்திர நாட்காட்டி</p>
          <h1 className="text-2xl font-semibold mt-1">Star Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">The Natchathiram at sunrise in Coimbatore each day, and whose star day it is.</p>
        </div>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming — next 30 days</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <div className="bg-card rounded-lg border border-border shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-semibold">{monthTitle(year, month, 'en-IN')}</h2>
                  <p className="text-sm text-muted-foreground">{monthTitle(year, month, 'ta-IN')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => shift(-1)} className="p-2 rounded-md hover:bg-muted transition-colors" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={goToday} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors">Today</button>
                  <button onClick={() => shift(1)} className="p-2 rounded-md hover:bg-muted transition-colors" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="p-2 sm:p-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAYS.map((w) => (
                    <div key={w.en} className="text-center py-1">
                      <div className="text-[10px] sm:text-xs text-muted-foreground">{w.ta}</div>
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground">{w.en}</div>
                    </div>
                  ))}
                </div>
                <div className={cn('grid grid-cols-7 gap-1', loading && 'opacity-60')}>
                  {cells.map((date, i) => {
                    if (!date) return <div key={`blank-${i}`} className="min-h-[72px] sm:min-h-[96px]" />;
                    const row = rowByDate.get(date);
                    const people = starDaysByDate.get(date) || [];
                    return (
                      <button
                        key={date}
                        onClick={() => setSelected(date)}
                        className={cn(
                          'min-h-[72px] sm:min-h-[96px] rounded-md border p-1 sm:p-1.5 text-left transition-colors hover:bg-muted/60 flex flex-col',
                          date === today ? 'border-primary bg-primary/5' : 'border-border',
                          people.length > 0 && 'bg-warning/5',
                        )}
                      >
                        <span className={cn('text-xs sm:text-sm font-medium', date === today && 'text-primary')}>{Number(date.slice(8))}</span>
                        {row && (
                          <span className="text-[10px] sm:text-xs leading-tight mt-0.5">
                            <span className="block truncate">{STARS[row.star].ta}</span>
                            <span className="hidden sm:block truncate text-muted-foreground">{STARS[row.star].en}</span>
                            {row.extra_star != null && (
                              <span className="block truncate text-muted-foreground">+ {STARS[row.extra_star].ta}</span>
                            )}
                          </span>
                        )}
                        {people.length > 0 && (
                          <span className="mt-auto pt-1 space-y-0.5">
                            {people.slice(0, 2).map((p) => (
                              <span key={p.sponsor.id} className="block truncate rounded bg-warning/15 text-warning-foreground px-1 text-[10px] sm:text-xs">⭐ {p.sponsor.name}</span>
                            ))}
                            {people.length > 2 && <span className="block text-[10px] text-muted-foreground">+{people.length - 2} more</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Star shown is the one at sunrise. “+” marks a star that starts after sunrise and ends before the next sunrise; that day counts as its star day.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            <div className="grid gap-3">
              {upcoming.map((u) => (
                <UpcomingCard key={`${u.sponsor.id}-${u.occurrence.date}`} item={u} />
              ))}
              {upcoming.length === 0 && (
                <Card className="py-14 text-center">
                  <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No star days in the next 30 days</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add a star to your monthly sponsors to see their star days here.</p>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected && formatStarDate(selected)}</DialogTitle>
            </DialogHeader>
            {selectedRow && (
              <div className="space-y-2 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <div className="font-medium">{astroLabel(STARS[selectedRow.star])}</div>
                  <div className="text-muted-foreground">
                    At sunrise {formatIstTime(selectedRow.sunrise, false)} · from {formatIstTime(selectedRow.star_start)} to {formatIstTime(selectedRow.star_end)}
                  </div>
                </div>
                {selectedRow.extra_star != null && (
                  <div className="rounded-md bg-muted p-3">
                    <div className="font-medium">+ {astroLabel(STARS[selectedRow.extra_star])}</div>
                    <div className="text-muted-foreground">From {formatIstTime(selectedRow.extra_start!)} to {formatIstTime(selectedRow.extra_end!)}</div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Star day for</h3>
              {selectedSponsors.map((u) => (
                <div key={u.sponsor.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => { setSelected(null); openMonthlySponsorDrawer(u.sponsor.id); }} className="font-medium truncate hover:text-primary text-left">{u.sponsor.name}</button>
                    <div className="text-xs text-muted-foreground">{astroLabel(STARS[u.sponsor.star!])}</div>
                    {u.sponsor.phone && (
                      <a href={`tel:${u.sponsor.phone}`} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{u.sponsor.phone}</a>
                    )}
                  </div>
                  <SendWishButton sponsor={u.sponsor} starDate={u.occurrence.date} />
                </div>
              ))}
              {selectedSponsors.length === 0 && <p className="text-sm text-muted-foreground">No monthly sponsor has this star day.</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function UpcomingCard({ item }: { item: UpcomingStarDay }) {
  const { sponsor, occurrence, daysUntil } = item;
  const raasi = effectiveRaasi(sponsor);
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 text-primary">
          <span className="text-lg font-semibold leading-none">{Number(occurrence.date.slice(8))}</span>
          <span className="text-[10px] uppercase">{new Date(`${occurrence.date}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => openMonthlySponsorDrawer(sponsor.id)} className="font-semibold hover:text-primary text-left">{sponsor.name}</button>
            <Badge variant={daysUntil <= 1 ? 'destructive' : 'secondary'}>{whenLabel(daysUntil)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {astroLabel(STARS[sponsor.star!])}{raasi != null && ` · ${astroLabel(RAASIS[raasi])}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatStarDate(occurrence.date)} · star from {formatIstTime(occurrence.start)} to {formatIstTime(occurrence.end)}
            {occurrence.alsoNextDay && ' · also at next day’s sunrise'}
          </p>
        </div>
        <div className="flex gap-2">
          {sponsor.phone && (
            <a href={`tel:${sponsor.phone}`}><Button variant="outline" size="icon" aria-label={`Call ${sponsor.name}`}><Phone className="h-4 w-4" /></Button></a>
          )}
          <SendWishButton sponsor={sponsor} starDate={occurrence.date} />
        </div>
      </div>
    </Card>
  );
}
