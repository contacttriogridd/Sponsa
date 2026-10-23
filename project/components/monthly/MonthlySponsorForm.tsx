'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/shared/DatePicker';
import { AstroCombobox } from '@/components/monthly/AstroCombobox';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { RAASIS, STARS, astroLabel, isValidCombination, padamNote, raasisOfStar, starsInRaasi } from '@/lib/natchathiram';
import { MONTHLY_STATUS_LABELS } from '@/lib/monthly-sponsors';
import type { MonthlySponsor, MonthlySponsorStatus } from '@/lib/types';

interface SponsorOption { id: string; full_name: string }

interface MonthlySponsorFormProps {
  sponsor?: MonthlySponsor | null;
  onSaved: (sponsor: MonthlySponsor) => void;
  onCancel: () => void;
}

const NO_SPONSOR = 'none';

export function MonthlySponsorForm({ sponsor, onSaved, onCancel }: MonthlySponsorFormProps) {
  const { appUser } = useAuth();
  const [sponsorOptions, setSponsorOptions] = useState<SponsorOption[]>([]);
  const [form, setForm] = useState({
    name: sponsor?.name || '',
    phone: sponsor?.phone || '',
    dob: sponsor?.dob || '',
    raasi: sponsor?.raasi ?? null as number | null,
    star: sponsor?.star ?? null as number | null,
    monthly_amount: sponsor?.monthly_amount != null ? String(sponsor.monthly_amount) : '',
    payment_day: sponsor?.payment_day ? String(sponsor.payment_day) : '',
    start_date: sponsor?.start_date || '',
    status: (sponsor?.status || 'active') as MonthlySponsorStatus,
    notes: sponsor?.notes || '',
    sponsor_id: sponsor?.sponsor_id || NO_SPONSOR,
    relationship: sponsor?.relationship || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmInvalid, setConfirmInvalid] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sponsors').select('id, full_name').order('full_name');
      setSponsorOptions((data || []) as SponsorOption[]);
    })();
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setConfirmInvalid(false);
  };

  function setStar(star: number | null) {
    setForm((f) => {
      // Fill in the Raasi when the star lies wholly in one.
      const only = star != null ? raasisOfStar(star) : [];
      return { ...f, star, raasi: f.raasi == null && only.length === 1 ? only[0] : f.raasi };
    });
    setConfirmInvalid(false);
  }

  const invalidCombo = !isValidCombination(form.raasi, form.star);
  const starOptions = form.raasi != null ? starsInRaasi(form.raasi) : STARS;

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (invalidCombo && !confirmInvalid) { setConfirmInvalid(true); return; }
    setBusy(true); setError('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      dob: form.dob || null,
      raasi: form.raasi,
      star: form.star,
      monthly_amount: form.monthly_amount ? Number(form.monthly_amount) : null,
      payment_day: form.payment_day ? Number(form.payment_day) : null,
      start_date: form.start_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      sponsor_id: form.sponsor_id === NO_SPONSOR ? null : form.sponsor_id,
      relationship: form.sponsor_id === NO_SPONSOR ? null : form.relationship.trim() || null,
    };
    const { data, error: err } = sponsor
      ? await supabase.from('monthly_sponsors').update(payload).eq('id', sponsor.id).select().single()
      : await supabase.from('monthly_sponsors').insert({ ...payload, created_by: appUser?.id || null }).select().single();
    setBusy(false);
    if (err) { setError('Unable to save. Please try again.'); return; }
    onSaved(data as MonthlySponsor);
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ms-name">Name *</Label>
          <Input id="ms-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-phone">Phone / WhatsApp</Label>
          <Input id="ms-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <DatePicker value={form.dob} onChange={(v) => set('dob', v)} fromYear={1920} toYear={new Date().getFullYear()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-raasi">Raasi (ராசி)</Label>
          <AstroCombobox id="ms-raasi" items={RAASIS} all={RAASIS} value={form.raasi} onChange={(v) => set('raasi', v)} placeholder="Select Raasi" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-star">Natchathiram (நட்சத்திரம்)</Label>
          <AstroCombobox
            id="ms-star"
            items={starOptions}
            all={STARS}
            value={form.star}
            onChange={setStar}
            placeholder="Select star"
            note={form.raasi != null ? (s) => padamNote(s.index, form.raasi!) : undefined}
          />
        </div>
        {invalidCombo && (
          <div className="sm:col-span-2 flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span>
              {astroLabel(STARS[form.star!])} is not in {astroLabel(RAASIS[form.raasi!])}. It falls in{' '}
              {raasisOfStar(form.star!).map((r) => astroLabel(RAASIS[r])).join(' / ')}.
              {confirmInvalid && ' Press save again to keep this combination anyway.'}
            </span>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="ms-amount">Monthly amount (₹)</Label>
          <Input id="ms-amount" type="number" min="0" inputMode="numeric" value={form.monthly_amount} onChange={(e) => set('monthly_amount', e.target.value)} placeholder="e.g. 1000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ms-day">Payment day of month</Label>
          <Input id="ms-day" type="number" min="1" max="31" inputMode="numeric" value={form.payment_day} onChange={(e) => set('payment_day', e.target.value)} placeholder="Optional, 1–31" />
        </div>
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <DatePicker value={form.start_date} onChange={(v) => set('start_date', v)} fromYear={2000} toYear={new Date().getFullYear() + 1} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v as MonthlySponsorStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(MONTHLY_STATUS_LABELS) as MonthlySponsorStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{MONTHLY_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Related sponsor (optional)</Label>
          <Select value={form.sponsor_id} onValueChange={(v) => set('sponsor_id', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SPONSOR}>None</SelectItem>
              {sponsorOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {form.sponsor_id !== NO_SPONSOR && (
          <div className="space-y-1.5">
            <Label htmlFor="ms-rel">Relationship to sponsor</Label>
            <Input id="ms-rel" value={form.relationship} onChange={(e) => set('relationship', e.target.value)} placeholder="e.g. Son, Daughter" />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ms-notes">Notes</Label>
          <Textarea id="ms-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any notes..." />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : confirmInvalid ? 'Save anyway' : sponsor ? 'Save Changes' : 'Add Monthly Sponsor'}
        </Button>
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
