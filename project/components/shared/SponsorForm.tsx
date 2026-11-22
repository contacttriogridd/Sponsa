'use client';

import { OccasionFields } from '@/components/shared/OccasionFields';
import { TITLES, occasionCategory, occasionKeyOf } from '@/lib/occasion-details';
import { draftFromOccasion, draftToRow, newDraft, validateDraft, type OccasionDraft } from '@/lib/occasion-draft';
import { useOccasionTypes } from '@/lib/use-occasion-types';
import type { SpecialOccasion } from '@/lib/types';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import type { Sponsor } from '@/lib/types';
import { COMMUNICATION_PREFERENCES } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_META, DONATION_CATEGORIES, PAYMENT_MODES, type DonationCategory } from '@/lib/donations';
import { cn } from '@/lib/utils';
import { PhoneInput, phoneForSave } from '@/components/shared/PhoneInput';

/** The occasion type a category adds (Monthly and the one-time kinds have their own fields). */
const CATEGORY_TYPE: Partial<Record<DonationCategory, string>> = {
  Birthday: 'self_birthday', 'Star Birthday': 'star_birthday', 'Wedding Anniversary': 'wedding_anniversary',
  'Memorial (Thithi)': 'death_anniversary', General: 'other', Annadhanam: 'other', Other: 'other',
};
const ONE_TIME: DonationCategory[] = ['General', 'Annadhanam', 'Other'];

/** Category an existing occasion belongs to. */
function categoryOfType(typeKey: string, category: string | undefined): DonationCategory {
  if (typeKey === 'star_birthday') return 'Star Birthday';
  if (category === 'birthday') return 'Birthday';
  if (category === 'anniversary') return 'Wedding Anniversary';
  if (category === 'remembrance') return 'Memorial (Thithi)';
  return 'Other';
}

const lastDayOf = (month: string) => { const [y, m] = month.split('-').map(Number); return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };

interface SponsorFormProps {
  sponsor?: Sponsor;
  onSaved?: (sponsor: Sponsor) => void;
  /** Cancel action; defaults to going back a page. */
  onCancel?: () => void;
}

const NO_TITLE = 'none';

export function SponsorForm({ sponsor, onSaved, onCancel }: SponsorFormProps) {
  const router = useRouter();
  const { appUser } = useAuth();
  const isEdit = !!sponsor;

  const [form, setForm] = useState({
    title: sponsor?.title || '',
    full_name: sponsor?.full_name || '',
    preferred_name: sponsor?.preferred_name || '',
    dob: sponsor?.dob || '',
    phone: sponsor?.phone || '',
    whatsapp: sponsor?.whatsapp || '',
    email: sponsor?.email || '',
    address: sponsor?.address || '',
    city: sponsor?.city || '',
    district: sponsor?.district || '',
    state: sponsor?.state || '',
    occupation: sponsor?.occupation || '',
    company: sponsor?.company || '',
    communication_preference: sponsor?.communication_preference || 'whatsapp',
    whatsapp_consent: sponsor?.whatsapp_consent ?? false,
    notes: sponsor?.notes || '',
    status: sponsor?.status || 'active',
    // Category and common sponsorship fields (migration 00028).
    sponsor_category: (sponsor?.sponsor_category || '') as DonationCategory | '',
    sponsorship_amount: sponsor?.sponsorship_amount != null ? String(sponsor.sponsorship_amount) : '',
    payment_mode: sponsor?.payment_mode || '',
    reminder_days_before: String(sponsor?.reminder_days_before ?? 3),
    preferred_language: sponsor?.preferred_language || 'ta',
  });
  // Monthly Sponsor category: saved as a monthly sponsor linked to this sponsor.
  const [monthly, setMonthly] = useState({ id: '', day: '', amount: '', start_month: '', end_month: '' });
  const setM = (k: keyof typeof monthly, v: string) => setMonthly((m) => ({ ...m, [k]: v }));

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Sponsor[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const types = useOccasionTypes();
  const [occasions, setOccasions] = useState<OccasionDraft[]>([]);
  const [removedOccasionIds, setRemovedOccasionIds] = useState<string[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Editing: load the sponsor's occasions so they are managed in one place.
  useEffect(() => {
    if (!sponsor) return;
    (async () => {
      const [{ data }, { data: ms }] = await Promise.all([
        supabase.from('special_occasions').select('*').eq('sponsor_id', sponsor.id).eq('active', true).order('occasion_date'),
        supabase.from('monthly_sponsors').select('*').eq('sponsor_id', sponsor.id).is('deleted_at', null).limit(1).maybeSingle(),
      ]);
      const rows = (data || []) as SpecialOccasion[];
      setOccasions(rows.map((o) => draftFromOccasion(o, occasionKeyOf(o))));
      if (ms) setMonthly({ id: ms.id, day: ms.payment_day ? String(ms.payment_day) : '', amount: ms.monthly_amount != null ? String(ms.monthly_amount) : '', start_month: (ms.start_date || '').slice(0, 7), end_month: (ms.end_date || '').slice(0, 7) });
      // Older sponsors have no category yet: take it from the monthly link or the first occasion.
      if (!sponsor.sponsor_category) {
        const first = rows[0];
        const guess: DonationCategory | '' = ms ? 'Monthly' : first ? categoryOfType(occasionKeyOf(first), occasionCategory(first)) : '';
        if (guess) setForm((f) => ({ ...f, sponsor_category: f.sponsor_category || guess }));
      }
    })();
  }, [sponsor]);

  const reminderDays = Math.max(0, Math.min(30, Number(form.reminder_days_before) || 0));
  /** A new occasion reminds "Reminder days before" ahead (default 3) and on the day. */
  const withReminder = (d: OccasionDraft): OccasionDraft => ({ ...d, remind_days_before: reminderDays > 0 ? [reminderDays, 0] : [0] });

  /** Picking a category adds that occasion (once), with the right fields. */
  function chooseCategory(category: DonationCategory) {
    setForm((f) => ({ ...f, sponsor_category: category }));
    const typeKey = CATEGORY_TYPE[category];
    if (!typeKey) return;
    const has = occasions.some((d) => ONE_TIME.includes(category) ? d.type_key === 'other' : categoryOfType(d.type_key, types.find((t) => t.key === d.type_key)?.category) === category);
    if (has) return;
    const draft = withReminder(newDraft(typeKey));
    if (ONE_TIME.includes(category)) {
      draft.repeat = { ...draft.repeat, recurrence: 'none' };
      draft.occasion_name_en = category === 'Annadhanam' ? 'Annadhanam' : '';
      draft.occasion_name_ta = category === 'Annadhanam' ? 'அன்னதானம்' : '';
    }
    setOccasions((all) => [...all, draft]);
  }

  const sponsorDefaults = { name: form.full_name, dob: form.dob, phone: form.whatsapp || form.phone };

  /** Saves the occasions; removed ones are deactivated, not deleted. */
  async function saveOccasions(sponsorId: string): Promise<boolean> {
    const fresh = occasions.filter((d) => !d.id).map((d) => draftToRow(d, types.find((t) => t.key === d.type_key), sponsorId, sponsorDefaults));
    const results = await Promise.all([
      fresh.length ? supabase.from('special_occasions').insert(fresh) : Promise.resolve({ error: null }),
      ...occasions.filter((d) => d.id && d.touched).map((d) => supabase.from('special_occasions')
        .update({ ...draftToRow(d, types.find((t) => t.key === d.type_key), sponsorId, sponsorDefaults), is_auto_generated: d.is_auto_generated ?? false })
        .eq('id', d.id!)),
      ...removedOccasionIds.map((id) => supabase.from('special_occasions').update({ active: false }).eq('id', id)),
    ]);
    return results.every((r) => !r.error);
  }

  /** Monthly Sponsor category: create or update the linked monthly sponsor. */
  async function saveMonthly(sponsorId: string): Promise<boolean> {
    if (form.sponsor_category !== 'Monthly') return true;
    const mode = form.payment_mode === 'Bank Transfer' ? 'Bank' : ['Cash', 'UPI'].includes(form.payment_mode) ? form.payment_mode : null;
    const row = {
      name: form.full_name.trim(), phone: phoneForSave(form.whatsapp).value || phoneForSave(form.phone).value,
      monthly_amount: Number(monthly.amount || form.sponsorship_amount) || null, payment_day: Number(monthly.day),
      start_date: `${monthly.start_month}-01`, end_date: monthly.end_month ? lastDayOf(monthly.end_month) : null,
      status: form.status === 'archived' ? 'stopped' : 'active', sponsor_id: sponsorId, relationship: 'Self',
      address: form.address || null, payment_mode: mode,
    };
    const { error: err } = monthly.id
      ? await supabase.from('monthly_sponsors').update(row).eq('id', monthly.id)
      : await supabase.from('monthly_sponsors').insert({ ...row, created_by: appUser?.id || null });
    if (err) {
      setError(err.code === 'PGRST204' ? 'The sponsor was saved; the monthly details need database migration 00028.' : 'The sponsor was saved, but the monthly details could not be saved. Please try again.');
      return false;
    }
    return true;
  }

  async function checkDuplicates(): Promise<Sponsor[]> {
    const name = form.full_name.trim();
    if (!form.phone && !form.whatsapp && !form.email && !name) return [];

    // Duplicates by the normalized number (+91XXXXXXXXXX), the form every number is stored in.
    const conditions: string[] = [];
    for (const n of [phoneForSave(form.phone).value, phoneForSave(form.whatsapp).value]) {
      if (n) conditions.push(`phone.eq.${n}`, `whatsapp.eq.${n}`);
    }
    if (form.email) conditions.push(`email.eq.${form.email}`);
    if (name) conditions.push(`full_name.ilike.%${name}%`);
    if (conditions.length === 0) return [];

    let query = supabase.from('sponsors').select('*').or(conditions.join(','));
    if (isEdit) query = query.neq('id', sponsor!.id);

    const { data } = await query.limit(5);
    return (data || []) as Sponsor[];
  }

  async function handleSubmit(force = false) {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    const category = form.sponsor_category;
    if (!category) { setError('Choose a category.'); return; }
    if (!isEdit && !form.whatsapp.trim()) { setError('Mobile (WhatsApp) is required.'); return; }
    // Numbers are stored as +91XXXXXXXXXX; an invalid one blocks saving.
    const wa = phoneForSave(form.whatsapp);
    const alt = phoneForSave(form.phone);
    if (wa.error) { setError(`Mobile (WhatsApp): ${wa.error}.`); return; }
    if (alt.error) { setError(`Alternate mobile: ${alt.error}.`); return; }
    if (!isEdit && category !== 'Monthly' && !(Number(form.sponsorship_amount) > 0)) { setError('Sponsorship amount is required.'); return; }
    if (category === 'Monthly') {
      const day = Number(monthly.day);
      if (!(day >= 1 && day <= 31)) { setError('Monthly Sponsor: the monthly date (1–31) is required.'); return; }
      if (!(Number(monthly.amount || form.sponsorship_amount) > 0)) { setError('Monthly Sponsor: the monthly amount is required.'); return; }
      if (!monthly.start_month) { setError('Monthly Sponsor: the start month is required.'); return; }
      if (monthly.end_month && monthly.end_month < monthly.start_month) { setError('Monthly Sponsor: the end month is before the start month.'); return; }
    } else if (!ONE_TIME.includes(category)) {
      const has = occasions.some((d) => categoryOfType(d.type_key, types.find((t) => t.key === d.type_key)?.category) === category);
      if (!has) { setError(`${category}: add the ${category.toLowerCase()} details below.`); return; }
    }
    for (const d of occasions.filter((x) => !x.id || x.touched)) {
      const problem = validateDraft(d, types.find((t) => t.key === d.type_key), sponsorDefaults);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    setError('');

    if (!force && !isEdit) {
      const dupes = await checkDuplicates();
      if (dupes.length > 0) {
        setDuplicates(dupes);
        setShowDuplicateWarning(true);
        setBusy(false);
        return;
      }
    }

    const payload = {
      title: form.title || null,
      full_name: form.full_name.trim(),
      preferred_name: form.preferred_name || null,
      dob: form.dob || null,
      phone: alt.value,
      whatsapp: wa.value,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      district: form.district || null,
      state: form.state || null,
      occupation: form.occupation || null,
      company: form.company || null,
      communication_preference: form.communication_preference || null,
      whatsapp_consent: form.whatsapp_consent,
      notes: form.notes || null,
      status: form.status,
      created_by: appUser?.id || null,
      sponsor_category: category,
      sponsorship_amount: form.sponsorship_amount ? Number(form.sponsorship_amount) : category === 'Monthly' && monthly.amount ? Number(monthly.amount) : null,
      payment_mode: form.payment_mode || null,
      reminder_days_before: reminderDays,
      preferred_language: form.preferred_language || null,
    };
    const { created_by: _createdBy, ...updatePayload } = payload;

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('sponsors')
        .update(updatePayload)
        .eq('id', sponsor!.id)
        .select()
        .single();
      setBusy(false);
      if (err) { setError(err.code === 'PGRST204' ? 'The category fields need database migration 00028. Run it in the Supabase SQL Editor, then save again.' : 'Unable to save sponsor. Please try again.'); return; }
      if (!(await saveMonthly(sponsor!.id))) return;
      // Auto-update sponsor birthday occasion if DOB changed
      if (form.dob && form.dob !== sponsor!.dob) {
        await supabase
          .from('special_occasions')
          .update({ occasion_date: form.dob, person_name: form.full_name })
          .eq('sponsor_id', sponsor!.id)
          .eq('is_auto_generated', true)
          .eq('occasion_type', 'Birthday')
          .is('family_member_id', null);
      }
      if (!(await saveOccasions(sponsor!.id))) {
        setError('The sponsor was saved, but some occasions could not be saved. Please try again.');
        return;
      }
      onSaved?.(data as Sponsor);
    } else {
      const { data, error: err } = await supabase
        .from('sponsors')
        .insert(payload)
        .select()
        .single();
      setBusy(false);
      if (err) { setError(err.code === 'PGRST204' ? 'The category fields need database migration 00028. Run it in the Supabase SQL Editor, then save again.' : 'Unable to save sponsor. Please try again.'); return; }
      const newSponsor = data as Sponsor;
      if (!(await saveMonthly(newSponsor.id))) { setCreatedId(newSponsor.id); onSaved?.(newSponsor); return; }
      // Only the occasions the user added become special days;
      // Date of Birth alone doesn't create one.
      if (!(await saveOccasions(newSponsor.id))) {
        // The sponsor exists now, so don't let a retry create a duplicate.
        setCreatedId(newSponsor.id);
        setError('The sponsor was created, but the occasions could not be saved. Please add them from the sponsor\'s Occasions tab.');
        onSaved?.(newSponsor);
        return;
      }
      onSaved?.(newSponsor);
      router.push(`/sponsors/${newSponsor.id}`);
    }
  }

  if (showDuplicateWarning) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-warning text-xl shrink-0">⚠️</div>
          <div>
            <h3 className="font-semibold">Possible existing sponsor found</h3>
            <p className="text-sm text-muted-foreground mt-1">A sponsor with similar contact details already exists.</p>
          </div>
        </div>
        <div className="space-y-2">
          {duplicates.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="font-medium">{d.full_name}</div>
                <div className="text-sm text-muted-foreground">{d.phone || d.email}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push(`/sponsors/${d.id}`)}>
                View Existing
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowDuplicateWarning(false)}>Go Back</Button>
          <Button onClick={() => { setShowDuplicateWarning(false); handleSubmit(true); }}>Create Anyway</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">{error}</div>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Category <span className="text-destructive">*</span></h3>
          <p className="text-sm text-muted-foreground mt-0.5">The fields below change with the category.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Category">
          {DONATION_CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={form.sponsor_category === c} onClick={() => chooseCategory(c)}
              className={cn('rounded-xl border p-2.5 text-left transition-colors', form.sponsor_category === c ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50')}>
              <span className="text-lg">{CATEGORY_META[c].icon}</span>
              <span className="block text-sm font-medium">{c}</span>
              <span className="block text-xs text-muted-foreground">{CATEGORY_META[c].ta}</span>
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sp-amount">Sponsorship amount (₹){!isEdit && form.sponsor_category !== 'Monthly' && <span className="text-destructive"> *</span>}</Label>
            <Input id="sp-amount" type="number" min="0" inputMode="numeric" value={form.sponsorship_amount} onChange={(e) => set('sponsorship_amount', e.target.value)} placeholder="e.g. 5000" />
          </div>
          <div className="space-y-1.5">
            <Label>Payment mode</Label>
            <Select value={form.payment_mode || 'none'} onValueChange={(v) => set('payment_mode', v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-remind">Reminder days before</Label>
            <Input id="sp-remind" type="number" min="0" max="30" inputMode="numeric" value={form.reminder_days_before} onChange={(e) => set('reminder_days_before', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred language</Label>
            <Select value={form.preferred_language} onValueChange={(v) => set('preferred_language', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ta">தமிழ் Tamil</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.sponsor_category === 'Monthly' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-day">Monthly date (1–31) <span className="text-destructive">*</span></Label>
              <Input id="m-day" type="number" min="1" max="31" inputMode="numeric" value={monthly.day} onChange={(e) => setM('day', e.target.value)} placeholder="e.g. 5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-amount">Monthly amount (₹) <span className="text-destructive">*</span></Label>
              <Input id="m-amount" type="number" min="0" inputMode="numeric" value={monthly.amount} onChange={(e) => setM('amount', e.target.value)} placeholder={form.sponsorship_amount || 'e.g. 1000'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-start">Start month <span className="text-destructive">*</span></Label>
              <Input id="m-start" type="month" value={monthly.start_month} onChange={(e) => setM('start_month', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-end">End month (optional)</Label>
              <Input id="m-end" type="month" value={monthly.end_month} onChange={(e) => setM('end_month', e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Saved in Monthly Sponsors too (linked to this sponsor), with reminders {reminderDays} day{reminderDays === 1 ? '' : 's'} before the monthly date. Add the star there for star-day wishes.</p>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Select value={form.title || NO_TITLE} onValueChange={(v) => set('title', v === NO_TITLE ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TITLE}>—</SelectItem>
                {TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="e.g. Raj Kumar" />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred Name</Label>
            <Input value={form.preferred_name} onChange={(e) => set('preferred_name', e.target.value)} placeholder="e.g. Raj" />
          </div>
          <div className="space-y-1.5">
            <Label>Date of Birth</Label>
            <DatePicker value={form.dob} onChange={(v) => set('dob', v)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Sponsoring For – Occasion</h3>
          <p className="text-sm text-muted-foreground mt-0.5">எந்த நிகழ்விற்காக?</p>
        </div>
        {occasions.map((d, i) => (
          <div key={d.localId} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Occasion {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Remove occasion"
                onClick={() => {
                  if (d.id) setRemovedOccasionIds((ids) => [...ids, d.id!]);
                  setOccasions((all) => all.filter((x) => x.localId !== d.localId));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <OccasionFields
              value={d}
              onChange={(next) => setOccasions((all) => all.map((x) => (x.localId === d.localId ? { ...next, touched: true } : x)))}
              types={types}
              sponsor={sponsorDefaults}
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setOccasions((all) => [...all, withReminder(newDraft(all.length === 0 ? CATEGORY_TYPE[form.sponsor_category as DonationCategory] || 'self_birthday' : 'family_birthday'))])}>
          <Plus className="h-4 w-4 mr-2" />{occasions.length === 0 ? 'Add an occasion' : 'Add another occasion'}
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Mobile (WhatsApp){!isEdit && <span className="text-destructive"> *</span>}</Label>
            <PhoneInput value={form.whatsapp} onChange={(v) => set('whatsapp', v)} />
          </div>
          <div className="space-y-1.5">
            <Label>Alternate mobile</Label>
            <PhoneInput value={form.phone} onChange={(v) => set('phone', v)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="sponsor@email.com" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Switch
            id="whatsapp_consent"
            checked={form.whatsapp_consent}
            onCheckedChange={(v) => set('whatsapp_consent', v)}
          />
          <Label htmlFor="whatsapp_consent" className="cursor-pointer">
            WhatsApp communication allowed
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label>Communication Preference</Label>
          <Select value={form.communication_preference} onValueChange={(v) => set('communication_preference', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMMUNICATION_PREFERENCES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Address</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
          </div>
          <div className="space-y-1.5">
            <Label>District</Label>
            <Input value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="District" />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Professional</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Occupation</Label>
            <Input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Businessman" />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.company} onChange={(e) => set('company', e.target.value)} placeholder="Company name" />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
        <Textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any additional notes about this sponsor..."
          rows={3}
        />
      </Card>

      <div className="flex gap-3 pb-4">
        {createdId ? (
          <Button onClick={() => router.push(`/sponsors/${createdId}`)} className="flex-1 sm:flex-none sm:min-w-32">
            Open Sponsor
          </Button>
        ) : (
        <Button onClick={() => handleSubmit()} disabled={busy} className="flex-1 sm:flex-none sm:min-w-32">
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sponsor'}
        </Button>
        )}
        <Button variant="outline" onClick={() => (onCancel ? onCancel() : router.back())}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
