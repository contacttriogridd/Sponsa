'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { STARS } from '@/lib/natchathiram';
import { familyStarSubjects, formatStarDate, parentIdOf, subjectLabel, todayIst, upcomingStarDays, whenLabel } from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { openMonthlySponsorDrawer, openSponsorDrawer } from '@/lib/drawer-store';
import type { ReminderItem } from '@/lib/today-reminders';
import { BOARD_CATEGORIES, WINDOWS, boardCategoryOf, windowOf, type BoardCategory, type WindowKey } from '@/lib/dates-board';
import { cn } from '@/lib/utils';
import type { MonthlyFamilyMember, MonthlySponsor } from '@/lib/types';

export interface BoardEntry {
  key: string;
  category: BoardCategory;
  date: string;
  days: number;
  name: string;
  detail: string;
  open: () => void;
}

/**
 * Dashboard: every sponsor date in the next 30 days — Star Birthday, Birthday,
 * Wedding Anniversary, Memorial and Monthly dates — by Today / Next 3 days /
 * This week / This month. Star days cover every active monthly sponsor and
 * family member with a star, for the full 30 days.
 */
export function DatesBoard({ items }: { items: ReminderItem[] }) {
  const today = todayIst();
  const [starEntries, setStarEntries] = useState<BoardEntry[] | null>(null);
  const [active, setActive] = useState<WindowKey>('today');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('monthly_sponsors').select('*').eq('status', 'active');
      if (error) { setStarEntries([]); return; }
      const base = ((data || []) as MonthlySponsor[]).filter((s) => !s.deleted_at);
      const { data: members } = await supabase.from('monthly_family_members').select('*');
      const subjects = [...base, ...familyStarSubjects(base, (members || []) as MonthlyFamilyMember[])];
      if (!subjects.some((s) => s.star != null)) { setStarEntries([]); return; }
      const rows = await loadStarCalendar(addDays(today, -1), addDays(today, 30));
      setStarEntries(upcomingStarDays(subjects, rows, today, 31).map((u) => ({
        key: `star:${u.sponsor.id}:${u.occurrence.date}`, category: 'star', date: u.occurrence.date, days: u.daysUntil,
        name: subjectLabel(u.sponsor), detail: `${STARS[u.sponsor.star!].ta} (${STARS[u.sponsor.star!].en})`,
        open: () => openMonthlySponsorDrawer(parentIdOf(u.sponsor)),
      })));
    })();
  }, [today]);

  const entries = useMemo(() => {
    const out: BoardEntry[] = [...(starEntries || [])];
    const seen = new Set<string>();
    for (const item of items) {
      if (item.group === 'past' || item.days < 0 || item.days > 30) continue;
      const category = boardCategoryOf(item);
      if (!category) continue;
      const key = item.key.replace('#next', '');
      if (seen.has(`${key}|${item.date}`)) continue;
      seen.add(`${key}|${item.date}`);
      out.push({
        key: `${key}|${item.date}`, category, date: item.date, days: item.days, name: item.name, detail: item.occasion,
        open: () => (item.monthlySponsor ? openMonthlySponsorDrawer(item.monthlySponsor.id) : item.sponsor ? openSponsorDrawer(item.sponsor.id) : undefined),
      });
    }
    return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
  }, [items, starEntries]);

  const counts = Object.fromEntries(WINDOWS.map((w) => [w.key, entries.filter((e) => windowOf(e.days) === w.key).length])) as Record<WindowKey, number>;
  const shown = entries.filter((e) => windowOf(e.days) === active);

  return (
    <Card className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold">Sponsor dates</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Star birthdays, birthdays, anniversaries, memorials and monthly dates (IST).</p>
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 self-start" role="tablist">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" role="tab" aria-selected={active === w.key} onClick={() => setActive(w.key)}
              className={cn('px-2.5 py-1 text-xs sm:text-sm rounded-md whitespace-nowrap', active === w.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {w.label} <span className="opacity-75">({counts[w.key]})</span>
            </button>
          ))}
        </div>
      </div>
      {starEntries === null ? (
        <div className="h-20 rounded-xl bg-muted animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {BOARD_CATEGORIES.map((c) => {
            const list = shown.filter((e) => e.category === c.key);
            return (
              <div key={c.key} className="rounded-xl border border-border p-3">
                <div className="text-sm font-medium mb-2">{c.icon} {c.label} <span className="text-muted-foreground font-normal">({list.length})</span></div>
                {list.length ? (
                  <ul className="space-y-1.5">
                    {list.map((e) => (
                      <li key={e.key} className="text-sm flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <button type="button" onClick={e.open} className="font-medium hover:text-primary text-left">{e.name}</button>
                          <span className="block text-xs text-muted-foreground truncate">{e.detail}</span>
                        </span>
                        <span className="text-xs text-muted-foreground text-right shrink-0">{formatStarDate(e.date).replace(/ \d{4}$/, '')}<span className="block">{whenLabel(e.days)}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">None</p>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
