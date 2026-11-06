'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DatePicker } from '@/components/shared/DatePicker';
import { AstroCombobox } from '@/components/monthly/AstroCombobox';
import { supabase } from '@/lib/supabase/client';
import { RAASIS, STARS, astroLabel, isValidCombination, padamNote, starsInRaasi } from '@/lib/natchathiram';
import { FAMILY_RELATIONSHIPS, relationshipLabel } from '@/lib/festival';
import { normalizeIndianNumber } from '@/lib/phone';
import { formatDateShort } from '@/lib/constants';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import type { MonthlyFamilyMember } from '@/lib/types';

const EMPTY = { name: '', relationship: '', relationship_other: '', star: null as number | null, raasi: null as number | null, dob: '', phone: '', address: '', notes: '' };

/** "Family Members / குடும்ப உறுப்பினர்கள்" in the monthly sponsor drawer. */
export function FamilyMembersSection({ monthlySponsorId }: { monthlySponsorId: string }) {
  const [members, setMembers] = useState<MonthlyFamilyMember[] | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [editing, setEditing] = useState<MonthlyFamilyMember | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MonthlyFamilyMember | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('monthly_family_members').select('*').eq('monthly_sponsor_id', monthlySponsorId).order('created_at');
    if (err) { setNotReady(true); setMembers([]); return; }
    setMembers((data || []) as MonthlyFamilyMember[]);
  }, [monthlySponsorId]);
  useEffect(() => { load(); }, [load]);

  function open(member: MonthlyFamilyMember | 'new') {
    setError('');
    setEditing(member);
    setForm(member === 'new' ? EMPTY : {
      name: member.name, relationship: member.relationship, relationship_other: member.relationship_other || '',
      star: member.star, raasi: member.raasi, dob: member.dob || '', phone: member.phone || '', address: member.address || '', notes: member.notes || '',
    });
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.relationship) { setError('Relationship is required.'); return; }
    if (form.star != null && !STARS[form.star]) { setError('Choose one of the 27 stars.'); return; }
    if (form.phone.trim() && !normalizeIndianNumber(form.phone)) { setError('Enter a valid 10-digit phone number.'); return; }
    setBusy(true); setError('');
    const payload = {
      monthly_sponsor_id: monthlySponsorId,
      name: form.name.trim(),
      relationship: form.relationship,
      relationship_other: form.relationship === 'Other' ? form.relationship_other.trim() || null : null,
      star: form.star,
      raasi: form.raasi,
      dob: form.dob || null,
      phone: form.phone.trim() ? normalizeIndianNumber(form.phone) : null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error: err } = editing === 'new'
      ? await supabase.from('monthly_family_members').insert(payload)
      : await supabase.from('monthly_family_members').update(payload).eq('id', (editing as MonthlyFamilyMember).id);
    setBusy(false);
    if (err) { setError('Unable to save. Please try again.'); return; }
    setEditing(null);
    load();
    notifyDrawerDataChanged();
  }

  async function remove() {
    if (!deleting) return;
    await supabase.from('monthly_family_members').delete().eq('id', deleting.id);
    setDeleting(null);
    load();
    notifyDrawerDataChanged();
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const starOptions = form.raasi != null ? starsInRaasi(form.raasi) : STARS;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Family Members / குடும்ப உறுப்பினர்கள்</h3>
        {!notReady && <Button size="sm" variant="outline" onClick={() => open('new')}><Plus className="h-4 w-4 mr-1" />Add</Button>}
      </div>
      {notReady && <p className="text-sm text-muted-foreground">Family members need database migration 00019.</p>}
      {members?.map((m) => (
        <div key={m.id} className="rounded-xl border border-border p-3 flex items-start gap-3 text-sm">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{m.name} <span className="text-muted-foreground font-normal">· {relationshipLabel(m)}</span></div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {[m.star != null ? astroLabel(STARS[m.star]) : null, m.raasi != null ? astroLabel(RAASIS[m.raasi]) : null, m.dob ? `DOB ${formatDateShort(m.dob)}` : null, m.phone].filter(Boolean).join(' · ') || 'No other details'}
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => open(m)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${m.name}`} onClick={() => setDeleting(m)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      {members?.length === 0 && !notReady && <p className="text-sm text-muted-foreground">No family members added.</p>}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === 'new' ? 'Add Family Member' : 'Edit Family Member'}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fm-name">Name *</Label>
              <Input id="fm-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship *</Label>
              <Select value={form.relationship || undefined} onValueChange={(v) => set('relationship', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FAMILY_RELATIONSHIPS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.relationship === 'Other' && (
              <div className="space-y-1.5">
                <Label htmlFor="fm-rel">Relationship (type it)</Label>
                <Input id="fm-rel" value={form.relationship_other} onChange={(e) => set('relationship_other', e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Raasi (ராசி)</Label>
              <AstroCombobox items={RAASIS} all={RAASIS} value={form.raasi} onChange={(v) => set('raasi', v)} placeholder="Select Raasi" />
            </div>
            <div className="space-y-1.5">
              <Label>Natchathiram (நட்சத்திரம்)</Label>
              <AstroCombobox items={starOptions} all={STARS} value={form.star} onChange={(v) => set('star', v)} placeholder="Select star"
                note={form.raasi != null ? (s) => padamNote(s.index, form.raasi!) : undefined} />
            </div>
            {!isValidCombination(form.raasi, form.star) && (
              <p className="sm:col-span-2 text-xs text-warning">This star isn&apos;t in the chosen Raasi.</p>
            )}
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <DatePicker value={form.dob} onChange={(v) => set('dob', v)} fromYear={1920} toYear={new Date().getFullYear()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fm-phone">Phone / WhatsApp</Label>
              <Input id="fm-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Uses the sponsor's number if empty" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fm-address">Address</Label>
              <Textarea id="fm-address" value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fm-notes">Notes</Label>
              <Textarea id="fm-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save'}</Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete family member?"
        description={deleting ? `${deleting.name} will be removed from this monthly sponsor.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </section>
  );
}
