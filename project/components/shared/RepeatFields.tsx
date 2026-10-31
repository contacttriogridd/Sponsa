'use client';

import { DatePicker } from './DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECURRENCE_LABELS, WEEKDAY_NAMES, type Recurrence } from '@/lib/recurrence';
import { repeatRow, type RepeatValue } from '@/lib/repeat-value';

export type { RepeatValue };
export const repeatPayload = repeatRow;

/** The "Repeats" dropdown with its weekday, day-of-month and end-date options. */
export function RepeatFields({ value, onChange }: { value: RepeatValue; onChange: (value: RepeatValue) => void }) {
  const toggleDay = (day: number) => onChange({
    ...value,
    weekdays: value.weekdays.includes(day) ? value.weekdays.filter((d) => d !== day) : [...value.weekdays, day].sort(),
  });

  return (
    <>
      <div className="space-y-1.5">
        <Label>Repeats</Label>
        <Select value={value.recurrence} onValueChange={(v) => onChange({ ...value, recurrence: v as Recurrence })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => <SelectItem key={r} value={r}>{RECURRENCE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {value.recurrence === 'monthly' && (
        <div className="space-y-1.5">
          <Label>Day of month</Label>
          <Input type="number" min="1" max="31" inputMode="numeric" value={value.day_of_month} onChange={(e) => onChange({ ...value, day_of_month: e.target.value })} placeholder="Same day as the date" />
        </div>
      )}
      {value.recurrence !== 'none' && (
        <div className="space-y-1.5">
          <Label>End date (optional)</Label>
          <DatePicker value={value.end_date} onChange={(v) => onChange({ ...value, end_date: v })} placeholder="No end" fromYear={new Date().getFullYear() - 1} toYear={new Date().getFullYear() + 20} />
        </div>
      )}
      {value.recurrence === 'weekly' && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label>On these days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_NAMES.map((name, day) => (
              <Button key={name} type="button" size="sm" variant={value.weekdays.includes(day) ? 'default' : 'outline'} onClick={() => toggleDay(day)}>
                {name.slice(0, 3)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">None selected means the same weekday as the date.</p>
        </div>
      )}
    </>
  );
}
