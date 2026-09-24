'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  /** Date as a `YYYY-MM-DD` string (the format stored in Supabase `date` columns). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
}

// Parse/format in local time so the picked day never shifts across time zones.
function parse(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

export function DatePicker({
  value, onChange, placeholder = 'Pick a date',
  fromYear = 1920, toYear = new Date().getFullYear() + 10,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground')}
        >
          <CalendarIcon className="h-4 w-4 mr-2 shrink-0" />
          <span className="flex-1 truncate">{selected ? format(selected, 'dd MMM yyyy') : placeholder}</span>
          {selected && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => { if (d) { onChange(format(d, 'yyyy-MM-dd')); setOpen(false); } }}
          captionLayout="dropdown-buttons"
          fromYear={fromYear}
          toYear={toYear}
          classNames={{
            caption_label: 'hidden',
            caption_dropdowns: 'flex gap-2',
            dropdown: 'rounded-md border border-input bg-background px-2 py-1 text-sm',
            vhidden: 'hidden',
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
