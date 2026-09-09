'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { FamilyMember } from '@/lib/types';
import { RELATIONSHIPS } from '@/lib/constants';

interface FamilyMemberFormProps {
  sponsorId: string;
  member?: FamilyMember;
  onSaved: (member: FamilyMember) => void;
  onCancel: () => void;
}

export function FamilyMemberForm({ sponsorId, member, onSaved, onCancel }: FamilyMemberFormProps) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    full_name: member?.full_name || '',
    relationship: member?.relationship || 'Other',
    dob: member?.dob || '',
    phone: member?.phone || '',
    whatsapp: member?.whatsapp || '',
    notes: member?.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.full_name.trim()) { setError('Name is required.'); return; }
    setBusy(true); setError('');

    const payload = {
      sponsor_id: sponsorId,
      full_name: form.full_name.trim(),
      relationship: form.relationship,
      dob: form.dob || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      notes: form.notes || null,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('family_members').update(payload).eq('id', member!.id).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      // Update auto-generated birthday occasion if DOB changed
      if (form.dob && form.dob !== member!.dob) {
        await supabase.from('special_occasions')
          .update({ occasion_date: form.dob, person_name: form.full_name })
          .eq('family_member_id', member!.id).eq('is_auto_generated', true);
      }
      onSaved(data as FamilyMember);
    } else {
      const { data, error: err } = await supabase
        .from('family_members').insert(payload).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      const newMember = data as FamilyMember;
      // Auto-create birthday occasion from DOB
      if (form.dob) {
        await supabase.from('special_occasions').insert({
          sponsor_id: sponsorId,
          family_member_id: newMember.id,
          person_name: form.full_name.trim(),
          relationship: form.relationship,
          occasion_type: 'Birthday',
          occasion_date: form.dob,
          recurring_yearly: true,
          is_auto_generated: true,
          active: true,
        });
      }
      onSaved(newMember);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Full Name <span className="text-destructive">*</span></Label>
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Family member name" />
        </div>
        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={form.relationship} onValueChange={(v) => set('relationship', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <Input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp</Label>
          <Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any notes..." />
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Member'}
        </Button>
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
