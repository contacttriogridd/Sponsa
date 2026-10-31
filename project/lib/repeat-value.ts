import type { Recurrence } from '@/lib/recurrence';

export interface RepeatValue {
  recurrence: Recurrence;
  weekdays: number[];
  day_of_month: string;
  end_date: string;
}

/** Database columns for a RepeatValue; `date` is the event's date, which is also its start. */
export function repeatRow(value: RepeatValue, date: string | null) {
  const repeating = value.recurrence !== 'none';
  return {
    recurrence: value.recurrence,
    weekdays: value.recurrence === 'weekly' && value.weekdays.length ? value.weekdays : null,
    day_of_month: value.recurrence === 'monthly' && value.day_of_month ? Number(value.day_of_month) : null,
    start_date: repeating ? date : null,
    end_date: repeating && value.end_date ? value.end_date : null,
  };
}
