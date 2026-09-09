'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  date: string;
  title: string;
  type: 'birthday' | 'anniversary' | 'donation' | 'followup' | 'other';
  sponsorId?: string;
}

interface CalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const TYPE_COLORS: Record<string, string> = {
  birthday: 'bg-primary/10 text-primary border-primary/20',
  anniversary: 'bg-warning/10 text-warning border-warning/20',
  donation: 'bg-success/10 text-success border-success/20',
  followup: 'bg-destructive/10 text-destructive border-destructive/20',
  other: 'bg-muted text-muted-foreground border-border',
};

const TYPE_DOTS: Record<string, string> = {
  birthday: 'bg-primary',
  anniversary: 'bg-warning',
  donation: 'bg-success',
  followup: 'bg-destructive',
  other: 'bg-muted-foreground',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function Calendar({ events, onEventClick }: CalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const isToday = (d: number) =>
    today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

  const dateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="min-h-[80px]" />;
            const key = dateKey(d);
            const dayEvents = eventsByDate.get(key) || [];
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[80px] p-1.5 rounded-md border transition-colors',
                  isToday(d)
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted/50'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1',
                  isToday(d) ? 'text-primary' : 'text-foreground'
                )}>
                  {d}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((e, ei) => (
                    <button
                      key={ei}
                      onClick={() => onEventClick?.(e)}
                      className={cn(
                        'w-full text-left text-xs px-1.5 py-1 rounded border truncate',
                        TYPE_COLORS[e.type] || TYPE_COLORS.other
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1.5">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 border-t border-border">
        {Object.entries(TYPE_DOTS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', color)} />
            <span className="text-xs text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
