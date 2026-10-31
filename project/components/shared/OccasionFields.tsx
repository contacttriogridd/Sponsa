'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/shared/DatePicker';
import { RepeatFields } from '@/components/shared/RepeatFields';
import { DONATION_TYPES } from '@/lib/constants';
import { CONTACT_RELATION, TITLES } from '@/lib/occasion-details';
import {
  ANNIVERSARY_WHOSE, FAMILY_RELATIONS, REMEMBRANCE_RELATIONS, type OccasionDraft, type OccasionTypeRow, type SponsorDefaults,
} from '@/lib/occasion-draft';
import { cn } from '@/lib/utils';

const NONE = 'none';

interface OccasionFieldsProps {
  value: OccasionDraft;
  onChange: (value: OccasionDraft) => void;
  types: OccasionTypeRow[];
  sponsor: SponsorDefaults;
}

/** One occasion: pick its type, then the fields that type needs. */
export function OccasionFields({ value, onChange, types, sponsor }: OccasionFieldsProps) {
  const type = types.find((t) => t.key === value.type_key);
  const category = type?.category || 'other';
  const own = value.type_key === 'self_birthday';
  const family = category === 'birthday' && !own;
  const remembrance = category === 'remembrance';
  const anniversary = category === 'anniversary';
  const other = category === 'other';
  const set = (patch: Partial<OccasionDraft>) => onChange({ ...value, ...patch });

  function setRelationship(relationship: string) {
    set({ relationship, contact_relation: CONTACT_RELATION[relationship] || value.contact_relation });
  }

  const relations = anniversary
    ? ANNIVERSARY_WHOSE
    : (remembrance ? REMEMBRANCE_RELATIONS : FAMILY_RELATIONS).map((r) => ({ value: r, label: r }));
  // An existing relationship not in this type's list stays selectable.
  const relationOptions = value.relationship && !relations.some((r) => r.value === value.relationship)
    ? [...relations, { value: value.relationship, label: value.relationship }]
    : relations;
  const visible = types.filter((t) => t.is_active || t.key === value.type_key);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => set({ type_key: t.key })}
            className={cn('rounded-xl border p-3 text-left transition-colors', value.type_key === t.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}
          >
            <span className="text-lg">{t.icon}</span>
            <span className="block text-sm font-medium mt-1">{t.name_en}</span>
            <span className="block text-xs text-muted-foreground">{t.name_ta}</span>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {other && (
          <>
            <div className="space-y-1.5">
              <Label>Occasion name (English){type?.key === 'other' && <span className="text-destructive"> *</span>}</Label>
              <Input value={value.occasion_name_en} onChange={(e) => set({ occasion_name_en: e.target.value })} placeholder={type?.key === 'other' ? 'e.g. House warming' : type?.name_en} />
            </div>
            <div className="space-y-1.5">
              <Label>Occasion name (Tamil)</Label>
              <Input lang="ta" value={value.occasion_name_ta} onChange={(e) => set({ occasion_name_ta: e.target.value })} placeholder={type?.key === 'other' ? 'தமிழில்' : type?.name_ta} />
            </div>
          </>
        )}
        {!own && !other && (
          <div className="space-y-1.5">
            <Label>{anniversary ? 'Whose anniversary' : 'Relationship'}{!anniversary && <span className="text-destructive"> *</span>}</Label>
            <Select value={value.relationship || undefined} onValueChange={setRelationship}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {relationOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {value.relationship === 'Other' && !own && !other && (
          <div className="space-y-1.5">
            <Label>Type the relationship <span className="text-destructive">*</span></Label>
            <Input value={value.relationship_other} onChange={(e) => set({ relationship_other: e.target.value })} placeholder="e.g. Uncle" />
          </div>
        )}
        {!own && (
          <div className="space-y-1.5">
            <Label>
              {remembrance ? 'Name of the departed' : anniversary ? 'Couple names' : other ? 'Person name (optional)' : "Person's name"}
              {type?.needs_person_name && <span className="text-destructive"> *</span>}
            </Label>
            <Input value={value.person_name} onChange={(e) => set({ person_name: e.target.value })} placeholder={remembrance ? 'e.g. Muthusamy' : anniversary ? 'e.g. Ravi & Meena' : 'e.g. Arun'} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>
            {remembrance ? 'Date of passing' : anniversary ? 'Wedding date' : category === 'birthday' ? 'Date of birth' : 'Date'}
            {!own && <span className="text-destructive"> *</span>}
          </Label>
          <DatePicker value={value.occasion_date} onChange={(v) => set({ occasion_date: v })} placeholder={own && sponsor.dob ? 'Uses the date of birth above' : undefined} />
        </div>
        {remembrance && (
          <div className="space-y-1.5">
            <Label>Tamil calendar date / thithi (optional)</Label>
            <Input lang="ta" value={value.thithi_note} onChange={(e) => set({ thithi_note: e.target.value })} placeholder="Note only" />
          </div>
        )}
        <RepeatFields value={value.repeat} onChange={(repeat) => set({ repeat })} />

        {!own && (
          <>
            <div className="space-y-1.5">
              <Label>Contact person name{(family || remembrance) && <span className="text-destructive"> *</span>}</Label>
              <Input value={value.contact_name} onChange={(e) => set({ contact_name: e.target.value })} placeholder={sponsor.name || "Sponsor's name"} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact title</Label>
              <Select value={value.contact_title || NONE} onValueChange={(v) => set({ contact_title: v === NONE ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Same as sponsor / none</SelectItem>
                  {TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact phone / WhatsApp{(family || remembrance) && <span className="text-destructive"> *</span>}</Label>
              <Input type="tel" value={value.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} placeholder={sponsor.phone || '+91 98765 43210'} />
            </div>
            {!other && (
              <div className="space-y-1.5">
                <Label>Contact&apos;s relation to the person</Label>
                <Input value={value.contact_relation} onChange={(e) => set({ contact_relation: e.target.value })} placeholder="e.g. Father/Mother" />
              </div>
            )}
          </>
        )}

        <div className="space-y-1.5">
          <Label>Linked donation (optional)</Label>
          <Select value={value.linked_donation_type || NONE} onValueChange={(v) => set({ linked_donation_type: v === NONE ? '' : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {DONATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {value.linked_donation_type && (
          <div className="space-y-1.5">
            <Label>Amount or quantity</Label>
            <Input value={value.linked_donation_details} onChange={(e) => set({ linked_donation_details: e.target.value })} placeholder="e.g. 50 meals" />
          </div>
        )}
        <div className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id={`remind-${value.localId}`}
            checked={!!value.remind_days_before?.includes(1)}
            onCheckedChange={(v) => set({ remind_days_before: v === true ? [1, 0] : [0] })}
          />
          <Label htmlFor={`remind-${value.localId}`} className="cursor-pointer font-normal">Remind me 1 day before as well as on the day</Label>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={value.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Any notes..." />
        </div>
      </div>
    </div>
  );
}
