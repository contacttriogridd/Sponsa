'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FAMILY_EVENT_CATEGORIES, FAMILY_EVENT_TYPES, FAMILY_RELATIONSHIPS, MONTHS,
  daysInMonth, getEventTypesForCategory, validateFamilyEventInput,
  type FamilyEventCategory, type FamilyEventInput,
} from '@/lib/family-events';

const CUSTOM = '__custom__';
const field = 'h-12 text-base';

interface FamilyEventFormProps {
  initial?: FamilyEventInput;
  defaultCategory?: FamilyEventCategory;
  onSubmit: (input: FamilyEventInput) => void;
  onCancel: () => void;
}

export function FamilyEventForm({ initial, defaultCategory, onSubmit, onCancel }: FamilyEventFormProps) {
  const isEdit = !!initial;
  const knownRelationship = !initial || (FAMILY_RELATIONSHIPS as readonly string[]).includes(initial.relationship);

  const [form, setForm] = useState<FamilyEventInput>(initial || {
    person_name: '',
    event_category: defaultCategory || '',
    event_type: '',
    relationship: '',
    event_day: null,
    event_month: null,
    event_year: null,
    notes: '',
  });
  const [customRelationship, setCustomRelationship] = useState(!knownRelationship);
  const [yearText, setYearText] = useState(initial?.event_year ? String(initial.event_year) : '');
  const [error, setError] = useState('');

  const set = <K extends keyof FamilyEventInput>(key: K, value: FamilyEventInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function chooseCategory(category: FamilyEventCategory) {
    // A type from another category would be invalid, so clear it.
    setForm((f) => ({ ...f, event_category: category, event_type: '' }));
  }

  function chooseType(key: string) {
    const type = FAMILY_EVENT_TYPES.find((t) => t.key === key);
    const previousDefault = FAMILY_EVENT_TYPES.find((t) => t.key === form.event_type)?.defaultRelationship;
    // Suggest the matching relationship, unless the user already chose a different one themselves.
    const userChose = !!form.relationship && form.relationship !== previousDefault;
    if (!userChose && type) setCustomRelationship(false);
    setForm((f) => ({
      ...f,
      event_type: key,
      relationship: userChose ? f.relationship : type?.defaultRelationship || '',
    }));
  }

  function changeYear(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    setYearText(digits);
    set('event_year', digits.length === 4 ? Number(digits) : null);
  }

  const maxDay = form.event_month ? daysInMonth(form.event_month, form.event_year) : 31;

  function handleSubmit() {
    if (yearText && yearText.length !== 4) { setError('Please enter the year with 4 digits, e.g. 1978.'); return; }
    const problem = validateFamilyEventInput(form);
    if (problem) { setError(problem); return; }
    onSubmit({ ...form, person_name: form.person_name.trim(), relationship: form.relationship.trim(), notes: form.notes.trim() });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmit(); }}
      noValidate
    >
      {error && (
        <p role="alert" className="text-base text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="fe-name" className="text-base">Person&apos;s Name <span className="text-destructive">*</span></Label>
        <Input
          id="fe-name"
          className={field}
          value={form.person_name}
          onChange={(e) => set('person_name', e.target.value)}
          placeholder="e.g. Lakshmi"
          maxLength={120}
          autoComplete="off"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-base">Event Category <span className="text-destructive">*</span></Label>
          <Select value={form.event_category} onValueChange={(v) => chooseCategory(v as FamilyEventCategory)}>
            <SelectTrigger className={field} aria-label="Event category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent>
              {FAMILY_EVENT_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key} className="text-base py-2.5">{c.emoji}&nbsp; {c.singular}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-base">Event Type <span className="text-destructive">*</span></Label>
          <Select value={form.event_type} onValueChange={chooseType} disabled={!form.event_category}>
            <SelectTrigger className={field} aria-label="Event type">
              <SelectValue placeholder={form.event_category ? 'Choose an event type' : 'Choose a category first'} />
            </SelectTrigger>
            <SelectContent>
              {form.event_category && getEventTypesForCategory(form.event_category).map((t) => (
                <SelectItem key={t.key} value={t.key} className="text-base py-2.5">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base">Relationship <span className="text-destructive">*</span></Label>
        <Select
          value={customRelationship ? CUSTOM : form.relationship}
          onValueChange={(v) => {
            if (v === CUSTOM) { setCustomRelationship(true); set('relationship', ''); }
            else { setCustomRelationship(false); set('relationship', v); }
          }}
        >
          <SelectTrigger className={field} aria-label="Relationship"><SelectValue placeholder="Choose a relationship" /></SelectTrigger>
          <SelectContent>
            {FAMILY_RELATIONSHIPS.map((r) => (
              <SelectItem key={r} value={r} className="text-base py-2.5">{r}</SelectItem>
            ))}
            <SelectItem value={CUSTOM} className="text-base py-2.5">Something else (type it)</SelectItem>
          </SelectContent>
        </Select>
        {customRelationship && (
          <Input
            className={field}
            value={form.relationship}
            onChange={(e) => set('relationship', e.target.value)}
            placeholder="e.g. Grandmother, Uncle, Son-in-law"
            maxLength={60}
            aria-label="Custom relationship"
            autoFocus
          />
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-base font-medium leading-none mb-2">
          Event Date <span className="text-destructive">*</span>
        </legend>
        <div className="grid grid-cols-[1fr_1.6fr] sm:grid-cols-[1fr_1.6fr_1.2fr] gap-3">
          <Select
            value={form.event_day ? String(form.event_day) : ''}
            onValueChange={(v) => set('event_day', Number(v))}
          >
            <SelectTrigger className={field} aria-label="Day"><SelectValue placeholder="Day" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)} disabled={d > maxDay} className="text-base py-2">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={form.event_month ? String(form.event_month) : ''}
            onValueChange={(v) => set('event_month', Number(v))}
          >
            <SelectTrigger className={field} aria-label="Month"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)} className="text-base py-2">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className={`${field} col-span-2 sm:col-span-1`}
            value={yearText}
            onChange={(e) => changeYear(e.target.value)}
            inputMode="numeric"
            placeholder="Year (e.g. 1978)"
            aria-label="Year"
          />
        </div>
        <p className="text-sm text-muted-foreground">Reminders repeat every year on this day.</p>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="fe-notes" className="text-base">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="fe-notes"
          className="text-base"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="e.g. Book the temple pooja, order a cake, call the family"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
        <Button type="button" variant="outline" size="lg" className="h-12 text-base" onClick={onCancel}>
          <X className="h-5 w-5 mr-2" />Cancel
        </Button>
        <Button type="submit" size="lg" className="h-12 text-base sm:min-w-44">
          <Save className="h-5 w-5 mr-2" />
          {isEdit ? 'Update Event' : 'Add Event'}
        </Button>
      </div>
    </form>
  );
}
