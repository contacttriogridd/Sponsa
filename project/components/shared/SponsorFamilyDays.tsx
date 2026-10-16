'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FamilyEventForm } from './FamilyEventForm';
import { cn } from '@/lib/utils';
import {
  FAMILY_EVENT_CATEGORIES, MONTHS, describeMilestone, formatFamilyEventDate,
  getEventTypeLabel, getNextFamilyEventOccurrence, getWhenLabel,
  type FamilyEventCategory, type FamilyEventInput,
} from '@/lib/family-events';

export interface FamilyDayDraft extends FamilyEventInput {
  key: string;
}

interface SponsorFamilyDaysProps {
  value: FamilyDayDraft[];
  onChange: (value: FamilyDayDraft[]) => void;
}

/**
 * Family days (birthdays, anniversaries, death anniversaries) collected on the
 * Add Sponsor page. Nothing is saved here: SponsorForm stores them as the new
 * sponsor's special occasions when "Create Sponsor" is pressed.
 */
export function SponsorFamilyDays({ value, onChange }: SponsorFamilyDaysProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyDayDraft | null>(null);
  const [category, setCategory] = useState<FamilyEventCategory | undefined>();

  function openAdd(c?: FamilyEventCategory) { setEditing(null); setCategory(c); setOpen(true); }
  function openEdit(d: FamilyDayDraft) { setEditing(d); setCategory(undefined); setOpen(true); }
  function close() { setOpen(false); setEditing(null); }

  function save(input: FamilyEventInput) {
    if (editing) onChange(value.map((d) => (d.key === editing.key ? { ...input, key: d.key } : d)));
    else onChange([...value, { ...input, key: `${Date.now()}-${Math.random()}` }]);
    close();
  }

  const withNext = value
    .map((d) => ({ d, next: getNextFamilyEventOccurrence({ event_day: d.event_day!, event_month: d.event_month!, event_year: d.event_year }) }))
    .sort((a, b) => a.next.daysUntil - b.next.daysUntil);

  return (
    <Card className="p-5 space-y-4 text-base">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Special Days &amp; Family Events</h3>
          <p className="text-muted-foreground mt-1">
            Birthdays, anniversaries and remembrance days. Only the events you add here are saved as special days.
          </p>
        </div>
        <Button type="button" size="lg" className="h-12 text-base px-6 shrink-0" onClick={() => openAdd()}>
          <Plus className="h-5 w-5 mr-2" />Add Family Event
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="grid sm:grid-cols-3 gap-3">
          {FAMILY_EVENT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => openAdd(c.key)}
              className="text-left rounded-xl border border-dashed border-border p-4 hover:border-primary hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="text-2xl" aria-hidden>{c.emoji}</div>
              <div className="font-semibold mt-2">Add {c.singular}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.description}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {FAMILY_EVENT_CATEGORIES.map((c) => {
            const items = withNext.filter(({ d }) => d.event_category === c.key);
            if (items.length === 0) return null;
            return (
              <div key={c.key}>
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  <span aria-hidden>{c.emoji}</span>{c.label} <span className="text-muted-foreground font-normal">({items.length})</span>
                </div>
                <ul className="space-y-2">
                  {items.map(({ d, next }) => {
                    const milestone = describeMilestone(c.key, next.years);
                    return (
                      <li key={d.key} className="rounded-xl border border-border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground" aria-hidden>
                            <span className="text-xl font-bold leading-none">{d.event_day}</span>
                            <span className="text-xs font-semibold uppercase mt-1">{MONTHS[d.event_month! - 1].slice(0, 3)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-lg font-semibold leading-snug break-words">{d.person_name}</div>
                            <div>
                              <span className="font-medium">{d.relationship}</span>
                              <span className="text-muted-foreground"> · {getEventTypeLabel(d.event_type)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                              <span>{formatFamilyEventDate({ event_day: d.event_day!, event_month: d.event_month!, event_year: d.event_year })}</span>
                              <span
                                className={cn(
                                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                  next.daysUntil === 0 ? 'bg-success text-success-foreground'
                                    : next.daysUntil === 1 ? 'bg-warning text-warning-foreground'
                                    : 'bg-secondary text-secondary-foreground',
                                )}
                              >
                                {next.daysUntil > 1 ? `Upcoming · ${getWhenLabel(next.daysUntil)}` : getWhenLabel(next.daysUntil)}
                              </span>
                              {milestone && <span>{milestone}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button type="button" variant="outline" className="h-11 text-base flex-1" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4 mr-2" />Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 text-base flex-1 text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => onChange(value.filter((x) => x.key !== d.key))}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Remove
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground">
            These are saved with the sponsor when you press <span className="font-medium">Create Sponsor</span>.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editing ? 'Edit Family Event' : 'Add Family Event'}</DialogTitle>
            <DialogDescription className="text-base">
              Fields marked <span className="text-destructive">*</span> are required.
            </DialogDescription>
          </DialogHeader>
          <FamilyEventForm
            key={editing?.key || `new-${category || ''}`}
            initial={editing || undefined}
            defaultCategory={category}
            onSubmit={save}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
