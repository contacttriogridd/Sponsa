'use client';

import { useState } from 'react';
import { CalendarClock, EyeOff, RotateCcw, StickyNote, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OBSERVANCE_KEYS, OBSERVANCE_META, type ObservanceKey, type ObservanceView } from '@/lib/observances';
import { deleteObservance, hideObservance, moveObservance, restoreObservance, setObservanceNote } from '@/lib/observances-store';
import { cn } from '@/lib/utils';

/** Chip colours (kept in components/ so Tailwind sees the class names). */
export const OBSERVANCE_CHIP: Record<ObservanceKey, string> = {
  amavasai: 'bg-zinc-700 text-zinc-50 dark:bg-zinc-600',
  pournami: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
  ekadashi: 'bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100',
  pradosham: 'bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100',
  sankatahara: 'bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100',
  sashti: 'bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100',
  shivaratri: 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100',
};

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

interface ChipProps {
  item: ObservanceView;
  isAdmin: boolean;
  onChanged: () => void;
  /** "cell": small, Tamil over English. "row": one line, for lists. */
  variant?: 'cell' | 'row';
}

/** One event; clicking it opens the details, and for admins the edit buttons. */
export function ObservanceChip({ item, isAdmin, onChanged, variant = 'cell' }: ChipProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'move' | 'note'>('view');
  const [moveTo, setMoveTo] = useState(item.on);
  const [note, setNote] = useState(item.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string | null>) {
    setBusy(true); setError(null);
    const err = await action();
    setBusy(false);
    if (err) { setError(err); return; }
    setOpen(false);
    onChanged();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setMode('view'); setMoveTo(item.on); setNote(item.note || ''); setError(null); } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'text-left rounded transition-opacity hover:opacity-80 max-w-full',
            OBSERVANCE_CHIP[item.event_key],
            item.is_hidden && 'opacity-40 line-through',
            variant === 'cell' ? 'flex items-start gap-0.5 w-full px-1 py-0.5 text-[10px] sm:text-xs leading-tight' : 'inline-flex items-center gap-1 px-2 py-0.5 text-sm',
          )}
          title={`${item.label.ta} / ${item.label.en}`}
        >
          <span aria-hidden>{item.label.icon}</span>
          {variant === 'cell' ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.label.ta}</span>
              <span className="hidden sm:block truncate opacity-80">{item.label.en}</span>
            </span>
          ) : (
            <span>{item.label.ta} / {item.label.en}</span>
          )}
          {(item.edited || item.source === 'manual') && <span className="text-[9px] opacity-70 shrink-0" title={item.edited ? 'Date edited by an admin' : 'Added by an admin'}>✎</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-semibold text-base">{item.label.icon} {item.label.ta}</div>
            <div className="text-muted-foreground">{item.label.en}</div>
            <div className="mt-1">{longDate(item.on)}</div>
            {item.edited && <div className="text-xs text-muted-foreground">Edited · CSV date was {longDate(item.date)}</div>}
            {item.source === 'manual' && <div className="text-xs text-muted-foreground">Added by an admin</div>}
            {item.is_hidden && <div className="text-xs text-destructive">Hidden — only admins see this</div>}
            {item.note && mode !== 'note' && <div className="mt-2 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{item.note}</div>}
          </div>

          {isAdmin && mode === 'move' && (
            <div className="space-y-2">
              <Label htmlFor={`move-${item.id}`}>Move to</Label>
              <Input id={`move-${item.id}`} type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !moveTo || moveTo === item.on} onClick={() => run(() => moveObservance(item, moveTo))}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
              </div>
            </div>
          )}

          {isAdmin && mode === 'note' && (
            <div className="space-y-2">
              <Label htmlFor={`note-${item.id}`}>Note</Label>
              <Textarea id={`note-${item.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Our temple observes it a day later" />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => run(() => setObservanceNote(item.id, note))}>Save note</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Cancel</Button>
              </div>
            </div>
          )}

          {isAdmin && mode === 'view' && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setMode('move')}><CalendarClock className="h-3.5 w-3.5 mr-1" />Move to another date</Button>
              {!item.is_hidden && <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => run(() => hideObservance(item.id))}><EyeOff className="h-3.5 w-3.5 mr-1" />Hide this date</Button>}
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setMode('note')}><StickyNote className="h-3.5 w-3.5 mr-1" />{item.note ? 'Edit note' : 'Add note'}</Button>
              {item.source === 'csv' && (item.edited || item.is_hidden) && (
                <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => run(() => restoreObservance(item.id))}><RotateCcw className="h-3.5 w-3.5 mr-1" />Restore original date</Button>
              )}
              {item.source === 'manual' && (
                <Button size="sm" variant="outline" className="mt-2 text-destructive" disabled={busy} onClick={() => run(() => deleteObservance(item.id))}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
              )}
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The 7 events with their icons and colours, and the Show / Hide toggle. */
export function ObservanceLegend({ show, onShowChange }: { show: boolean; onShowChange: (show: boolean) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className={cn('flex flex-wrap gap-1.5 flex-1', !show && 'opacity-50')}>
        {OBSERVANCE_KEYS.map((key) => (
          <span key={key} className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs', OBSERVANCE_CHIP[key])}>
            <span aria-hidden>{OBSERVANCE_META[key].icon}</span>{OBSERVANCE_META[key].ta} · {OBSERVANCE_META[key].short}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch id="show-observances" checked={show} onCheckedChange={onShowChange} />
        <Label htmlFor="show-observances" className="text-sm">Show events</Label>
      </div>
    </div>
  );
}
