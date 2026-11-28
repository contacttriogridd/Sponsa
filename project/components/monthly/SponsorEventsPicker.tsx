'use client';

import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OBSERVANCE_CHIP } from '@/components/monthly/ObservanceChip';
import { OBSERVANCE_KEYS, OBSERVANCE_META, type ObservanceKey } from '@/lib/observances';
import { PAKSHA_OPTIONS, hasPaksha, sponsorEventsOf, type EventPaksha, type SponsorEvent } from '@/lib/event-wishes';
import { cn } from '@/lib/utils';

/** Form state for one selected event; the amount stays text while typing. */
export interface EventDraft {
  event_key: ObservanceKey;
  amount: string;
  paksha: EventPaksha;
}

export function eventDraftsFrom(sponsor: { sponsor_events?: unknown } | null | undefined): EventDraft[] {
  return sponsorEventsOf(sponsor || {}).map((e) => ({ event_key: e.event_key, amount: e.amount != null ? String(e.amount) : '', paksha: e.paksha }));
}

/** What is saved in monthly_sponsors.sponsor_events. */
export function sponsorEventsFromDrafts(drafts: EventDraft[]): SponsorEvent[] {
  return sponsorEventsOf({
    sponsor_events: drafts.map((d) => ({ event_key: d.event_key, amount: d.amount.trim() === '' ? null : Number(d.amount), paksha: hasPaksha(d.event_key) ? d.paksha : 'both' })),
  });
}

interface Props {
  value: EventDraft[];
  onChange: (value: EventDraft[]) => void;
  /** Placeholder for the amount inputs (the Monthly amount). */
  monthlyAmount: string;
}

/** "Monthly Events (மாதாந்திர விசேஷ நாட்கள்)": the Star Calendar's events as multi-select chips. */
export function SponsorEventsPicker({ value, onChange, monthlyAmount }: Props) {
  const selected = new Map(value.map((d) => [d.event_key, d]));

  const toggle = (key: ObservanceKey) => {
    if (selected.has(key)) onChange(value.filter((d) => d.event_key !== key));
    else onChange(OBSERVANCE_KEYS.filter((k) => k === key || selected.has(k)).map((k) => selected.get(k) || { event_key: k, amount: '', paksha: 'both' }));
  };
  const update = (key: ObservanceKey, patch: Partial<EventDraft>) => onChange(value.map((d) => (d.event_key === key ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-2.5 rounded-xl border border-border p-3">
      <div>
        <Label>Monthly Events (மாதாந்திர விசேஷ நாட்கள்) <span className="text-muted-foreground font-normal">— optional</span></Label>
        <p className="text-xs text-muted-foreground mt-0.5">Sponsor will get a wish message on each selected event day.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Monthly events">
        {OBSERVANCE_KEYS.map((key) => {
          const on = selected.has(key);
          const meta = OBSERVANCE_META[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(key)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:text-sm border transition-colors',
                on ? cn(OBSERVANCE_CHIP[key], 'border-transparent ring-2 ring-primary/40') : 'border-border bg-background hover:bg-muted text-foreground',
              )}
            >
              {on ? <Check className="h-3.5 w-3.5" /> : <span aria-hidden>{meta.icon}</span>}
              {meta.ta} · {meta.short}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <div className="space-y-2 pt-1">
          {value.map((d) => {
            const meta = OBSERVANCE_META[d.event_key];
            return (
              <div key={d.event_key} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
                <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs min-w-[8.5rem]', OBSERVANCE_CHIP[d.event_key])}>
                  {meta.icon} {meta.ta}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    aria-label={`${meta.short} amount`}
                    value={d.amount}
                    onChange={(e) => update(d.event_key, { amount: e.target.value })}
                    placeholder={monthlyAmount || 'Monthly amount'}
                    className="h-8 w-28"
                  />
                </div>
                {hasPaksha(d.event_key) && (
                  <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label={`${meta.short} paksha`}>
                    {PAKSHA_OPTIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        aria-pressed={d.paksha === p.value}
                        onClick={() => update(d.event_key, { paksha: p.value })}
                        className={cn('px-2 py-0.5 text-xs rounded', d.paksha === p.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                      >
                        {p.value === 'both' ? 'Both' : p.ta}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
