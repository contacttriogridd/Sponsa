'use client';

import { useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/shared/DatePicker';
import { yearsFrom } from '@/lib/occasion-draft';
import { cn } from '@/lib/utils';

interface Props {
  kind: 'star' | 'thithi';
  month: number | null;
  /** The star (0–26) or thithi (0–29). */
  value: number | null;
  dates: Record<string, string>;
  onChange: (dates: Record<string, string>) => void;
}

const todayIst = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The English date of a Star Birthday / Thithi memorial for this year and the
 * next four. Worked out from the Tamil month and star / thithi (sunrise in
 * Coimbatore, like the Star Calendar), and editable by hand; years without a
 * date are flagged as missing.
 */
export function YearlyDatesField({ kind, month, value, dates, onChange }: Props) {
  const years = yearsFrom(todayIst());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Saved dates are not recalculated on open; only when the month / star / thithi changes.
  const lastKey = useRef(month != null && value != null && Object.keys(dates).length ? `${month}|${value}` : '');

  async function calculate() {
    if (month == null || value == null) return;
    setBusy(true); setNote(null);
    try {
      // The astronomy code is only loaded when needed.
      const { yearlyDates } = await import('@/lib/tamil-calendar');
      const computed = yearlyDates(kind, month, value, Number(years[0]), years.length);
      onChange(computed);
      const missing = years.filter((y) => !computed[y]);
      setNote(missing.length ? `No matching day found for ${missing.join(', ')} — enter those by hand.` : 'Calculated. Check against your panchangam; you can change any date.');
    } catch {
      setNote('Could not calculate the dates — enter them by hand.');
    }
    setBusy(false);
  }

  useEffect(() => {
    const key = month != null && value != null ? `${month}|${value}` : '';
    if (key && key !== lastKey.current) { lastKey.current = key; calculate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, value]);

  const missing = years.filter((y) => !dates[y]);

  return (
    <div className="space-y-2 sm:col-span-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label>English date each year <span className="text-destructive">*</span></Label>
        <Button type="button" variant="outline" size="sm" disabled={busy || month == null || value == null} onClick={calculate}>
          <Calculator className="h-3.5 w-3.5 mr-1.5" />{busy ? 'Calculating…' : 'Calculate dates'}
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {years.map((y) => (
          <div key={y} className={cn('rounded-lg border p-2 space-y-1', dates[y] ? 'border-border' : 'border-warning/50 bg-warning/5')}>
            <div className="text-xs font-medium flex justify-between">{y}{!dates[y] && <span className="text-warning-foreground">Missing</span>}</div>
            <DatePicker value={dates[y] || ''} onChange={(v) => {
              const next = { ...dates };
              if (v) next[y] = v; else delete next[y];
              onChange(next);
            }} />
          </div>
        ))}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {!note && missing.length > 0 && month != null && value != null && <p className="text-xs text-warning-foreground">Missing: {missing.join(', ')}.</p>}
      {(month == null || value == null) && <p className="text-xs text-muted-foreground">Choose the Tamil month and {kind === 'star' ? 'star' : 'thithi'} to calculate the dates.</p>}
    </div>
  );
}
