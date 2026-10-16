'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarHeart, CheckCircle2, ChevronDown, Pencil, Plus, Search, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { FamilyEventForm } from './FamilyEventForm';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type { FamilyEvent, FamilyEventCategory } from '@/lib/types';
import {
  FAMILY_EVENT_CATEGORIES, MONTHS, describeFamilyEventError, describeMilestone,
  formatFamilyEventDate, formatOccurrenceDate, getEventTypeLabel, getWhenLabel,
  sortByNextOccurrence, type FamilyEventWithNext,
} from '@/lib/family-events';

const UPCOMING_WINDOW_DAYS = 30;

type Notice = { kind: 'success' | 'error'; text: string } | null;
type CategoryFilter = 'all' | FamilyEventCategory;

interface FamilyEventsManagerProps {
  /** Lets the parent show the saved-event count (e.g. on a tab label). */
  onCountChange?: (count: number) => void;
}

export function FamilyEventsManager({ onCountChange }: FamilyEventsManagerProps) {
  const { appUser } = useAuth();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [collapsed, setCollapsed] = useState<Set<FamilyEventCategory>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyEvent | null>(null);
  const [formCategory, setFormCategory] = useState<FamilyEventCategory | undefined>();
  const [deleting, setDeleting] = useState<FamilyEvent | null>(null);

  const load = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('family_events')
      .select('*')
      .eq('user_id', appUser.id)
      .order('person_name');
    setLoading(false);
    if (error) { setLoadError(describeFamilyEventError(error, 'Unable to load your family events. Please refresh the page.')); return; }
    setEvents((data || []) as FamilyEvent[]);
  }, [appUser]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { onCountChange?.(events.length); }, [events.length, onCountChange]);

  useEffect(() => {
    if (notice?.kind !== 'success') return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const sorted = useMemo(() => sortByNextOccurrence(events), [events]);
  const upcoming = useMemo(() => sorted.filter((e) => e.next.daysUntil <= UPCOMING_WINDOW_DAYS), [sorted]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(({ event }) =>
      (filter === 'all' || event.event_category === filter) &&
      (!q ||
        event.person_name.toLowerCase().includes(q) ||
        event.relationship.toLowerCase().includes(q) ||
        getEventTypeLabel(event.event_type).toLowerCase().includes(q) ||
        (event.notes || '').toLowerCase().includes(q)));
  }, [sorted, search, filter]);

  function openAdd(category?: FamilyEventCategory) {
    setEditing(null);
    setFormCategory(category);
    setFormOpen(true);
  }

  function openEdit(event: FamilyEvent) {
    setEditing(event);
    setFormCategory(undefined);
    setFormOpen(true);
  }

  function handleSaved(saved: FamilyEvent, isEdit: boolean) {
    setEvents((list) => isEdit ? list.map((e) => (e.id === saved.id ? saved : e)) : [...list, saved]);
    setFormOpen(false);
    setEditing(null);
    setCollapsed((c) => { const n = new Set(c); n.delete(saved.event_category); return n; });
    setNotice({ kind: 'success', text: isEdit ? `Changes to ${saved.person_name}'s event were saved.` : `${saved.person_name}'s event was added.` });
  }

  async function handleDelete() {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    const { data, error } = await supabase
      .from('family_events')
      .delete()
      .eq('id', target.id)
      .select('id');
    if (error || !data?.length) {
      setNotice({ kind: 'error', text: describeFamilyEventError(error, 'Unable to delete this event. Please try again.') });
      return;
    }
    setEvents((list) => list.filter((e) => e.id !== target.id));
    setNotice({ kind: 'success', text: `${target.person_name}'s ${getEventTypeLabel(target.event_type)} was deleted.` });
  }

  function toggleCategory(key: FamilyEventCategory) {
    setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  if (loading) {
    return (
      <Card className="p-8 text-center text-base text-muted-foreground">Loading your family events...</Card>
    );
  }

  const shownCategories = FAMILY_EVENT_CATEGORIES.filter((c) => filter === 'all' || c.key === filter);
  const searching = search.trim().length > 0;

  return (
    <div className="space-y-5 text-base">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Family Events &amp; Reminders</h3>
          <p className="text-muted-foreground mt-1">
            Birthdays, anniversaries and remembrance days of your family, in one place.
          </p>
        </div>
        <Button type="button" size="lg" className="h-12 text-base px-6 shrink-0" onClick={() => openAdd()} disabled={!!loadError}>
          <Plus className="h-5 w-5 mr-2" />Add Family Event
        </Button>
      </div>

      <div aria-live="polite">
        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-start gap-3 rounded-lg px-4 py-3',
              notice.kind === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {notice.kind === 'success' ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
            <span className="font-medium">{notice.text}</span>
          </div>
        )}
      </div>

      {loadError ? (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <p>{loadError}</p>
          </div>
          <Button variant="outline" className="h-11 text-base" onClick={load}>Try Again</Button>
        </Card>
      ) : events.length === 0 ? (
        <>
          <EmptyState
            icon={CalendarHeart}
            title="No family events yet"
            description="Add birthdays, wedding anniversaries and death anniversaries so you never miss an important day."
            action={
              <Button size="lg" className="h-12 text-base px-6" onClick={() => openAdd()}>
                <Plus className="h-5 w-5 mr-2" />Add Your First Event
              </Button>
            }
          />
          <div className="grid sm:grid-cols-3 gap-3">
            {FAMILY_EVENT_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => openAdd(c.key)}
                className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="text-2xl" aria-hidden>{c.emoji}</div>
                <div className="font-semibold mt-2">Add {c.singular}</div>
                <div className="text-sm text-muted-foreground mt-1">{c.description}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <UpcomingCard items={upcoming} />

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" aria-hidden />
              <Input
                className="h-12 text-base pl-11"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, relationship or event"
                aria-label="Search family events"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All ({events.length})
              </FilterChip>
              {FAMILY_EVENT_CATEGORIES.map((c) => (
                <FilterChip key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
                  <span aria-hidden>{c.emoji}</span> {c.label} ({events.filter((e) => e.event_category === c.key).length})
                </FilterChip>
              ))}
            </div>
          </div>

          {searching && visible.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No events match &ldquo;{search.trim()}&rdquo;.
            </Card>
          ) : (
            <div className="space-y-4">
              {shownCategories.map((c) => {
                const items = visible.filter((e) => e.event.event_category === c.key);
                if (searching && items.length === 0) return null;
                const open = !collapsed.has(c.key);
                return (
                  <Card key={c.key} className="overflow-hidden">
                    <div className="flex items-center gap-3 p-4 sm:p-5">
                      <button
                        type="button"
                        onClick={() => toggleCategory(c.key)}
                        aria-expanded={open}
                        aria-controls={`fe-panel-${c.key}`}
                        className="flex flex-1 items-center gap-3 text-left min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl" aria-hidden>{c.emoji}</span>
                        <span className="min-w-0">
                          <span className="block text-lg font-semibold">
                            {c.label} <span className="text-muted-foreground font-normal">({items.length})</span>
                          </span>
                          <span className="block text-sm text-muted-foreground truncate">{c.description}</span>
                        </span>
                        <ChevronDown className={cn('h-5 w-5 ml-auto shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
                      </button>
                      <Button variant="outline" className="h-11 text-base shrink-0" onClick={() => openAdd(c.key)} aria-label={`Add ${c.singular}`}>
                        <Plus className="h-5 w-5 sm:mr-1.5" /><span className="hidden sm:inline">Add</span>
                      </Button>
                    </div>
                    {open && (
                      <div id={`fe-panel-${c.key}`} className="border-t border-border">
                        {items.length === 0 ? (
                          <p className="p-5 text-muted-foreground">No {c.label.toLowerCase()} saved yet.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {items.map((item) => (
                              <EventRow key={item.event.id} item={item} onEdit={() => openEdit(item.event)} onDelete={() => setDeleting(item.event)} />
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing ? 'Edit Family Event' : 'Add Family Event'}</DialogTitle>
            <DialogDescription className="text-base">
              Fields marked <span className="text-destructive">*</span> are required.
            </DialogDescription>
          </DialogHeader>
          <FamilyEventForm
            key={editing?.id || `new-${formCategory || ''}`}
            event={editing || undefined}
            defaultCategory={formCategory}
            onSaved={handleSaved}
            onCancel={() => { setFormOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this event?"
        description={deleting ? `${deleting.person_name}'s ${getEventTypeLabel(deleting.event_type)} (${formatFamilyEventDate(deleting)}) will be removed permanently.` : ''}
        confirmLabel="Delete Event"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-11 rounded-full border px-4 text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

function WhenBadge({ days, short }: { days: number; short?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
        days === 0 ? 'bg-success text-success-foreground'
          : days === 1 ? 'bg-warning text-warning-foreground'
          : 'bg-secondary text-secondary-foreground',
      )}
    >
      {days > 1 && !short ? `Upcoming · ${getWhenLabel(days)}` : getWhenLabel(days)}
    </span>
  );
}

function DateTile({ date }: { date: Date }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground" aria-hidden>
      <span className="text-xl font-bold leading-none">{date.getDate()}</span>
      <span className="text-xs font-semibold uppercase mt-1">{MONTHS[date.getMonth()].slice(0, 3)}</span>
    </div>
  );
}

function UpcomingCard({ items }: { items: FamilyEventWithNext[] }) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-lg font-semibold">Coming Up</h3>
      <p className="text-sm text-muted-foreground">Next {UPCOMING_WINDOW_DAYS} days, soonest first</p>
      {items.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No family events in the next {UPCOMING_WINDOW_DAYS} days.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map(({ event, next }) => {
            const milestone = describeMilestone(event.event_category, next.years);
            return (
              <li key={event.id} className={cn('flex items-center gap-3 sm:gap-4 rounded-xl p-3', next.daysUntil === 0 ? 'bg-success/10' : 'bg-muted/60')}>
                <DateTile date={next.date} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-lg leading-snug">{event.person_name}</div>
                  <div className="text-muted-foreground">
                    {getEventTypeLabel(event.event_type)}
                    {milestone ? ` · ${milestone}` : ''}
                  </div>
                </div>
                <div className="hidden sm:block shrink-0"><WhenBadge days={next.daysUntil} /></div>
                <div className="sm:hidden shrink-0"><WhenBadge days={next.daysUntil} short /></div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function EventRow({ item, onEdit, onDelete }: { item: FamilyEventWithNext; onEdit: () => void; onDelete: () => void }) {
  const { event, next } = item;
  const milestone = describeMilestone(event.event_category, next.years);
  return (
    <li className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="flex items-start gap-4 flex-1 min-w-0">
        <DateTile date={next.date} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-lg font-semibold leading-snug break-words">{event.person_name}</div>
          <div>
            <span className="font-medium">{event.relationship}</span>
            <span className="text-muted-foreground"> · {getEventTypeLabel(event.event_type)}</span>
          </div>
          <div className="text-muted-foreground">
            Date: {formatFamilyEventDate(event)}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <WhenBadge days={next.daysUntil} />
            <span className="text-sm text-muted-foreground">
              {formatOccurrenceDate(next.date)}{milestone ? ` · ${milestone}` : ''}
            </span>
          </div>
          {event.notes && <p className="text-muted-foreground pt-1 whitespace-pre-line break-words">{event.notes}</p>}
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col sm:w-28 shrink-0">
        <Button variant="outline" className="h-11 text-base flex-1" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />Edit
        </Button>
        <Button variant="outline" className="h-11 text-base flex-1 text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />Delete
        </Button>
      </div>
    </li>
  );
}
