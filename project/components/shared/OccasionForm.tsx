'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { SpecialOccasion } from '@/lib/types';
import { OCCASION_TYPES, RELATIONSHIPS } from '@/lib/constants';

interface OccasionFormProps {
  sponsorId: string;
  occasion?: SpecialOccasion;
  defaultPersonName?: string;
  onSaved: (occasion: SpecialOccasion) => void;
  onCancel: () => void;
}

export function OccasionForm({ sponsorId, occasion, defaultPersonName, onSaved, onCancel }: OccasionFormProps) {
  const isEdit = !!occasion;
  const [form, setForm] = useState({
    person_name: occasion?.person_name || defaultPersonName || '',
    relationship: occasion?.relationship || 'Self',
    occasion_type: occasion?.occasion_type || 'Birthday',
    occasion_date: occasion?.occasion_date || '',
    recurring_yearly: occasion?.recurring_yearly ?? true,
    active: occasion?.active ?? true,
    notes: occasion?.notes || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.person_name.trim()) { setError('Person name is required.'); return; }
    if (!form.occasion_date) { setError('Date is required.'); return; }
    setBusy(true); setError('');

    const payload = {
      sponsor_id: sponsorId,
      person_name: form.person_name.trim(),
      relationship: form.relationship || null,
      occasion_type: form.occasion_type,
      occasion_date: form.occasion_date,
      recurring_yearly: form.recurring_yearly,
      active: form.active,
      notes: form.notes || null,
      is_auto_generated: false,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('special_occasions').update(payload).eq('id', occasion!.id).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      onSaved(data as SpecialOccasion);
    } else {
      const { data, error: err } = await supabase
        .from('special_occasions').insert(payload).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      onSaved(data as SpecialOccasion);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Person Name <span className="text-destructive">*</span></Label>
          <Input value={form.person_name} onChange={(e) => set('person_name', e.target.value)} placeholder="Name" />
        </div>
        <div className="space-y-1.5">
          <Label>Relationship</Label>
          <Select value={form.relationship || 'Self'} onValueChange={(v) => set('relationship', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Self">Self</SelectItem>
              {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Occasion Type</Label>
          <Select value={form.occasion_type} onValueChange={(v) => set('occasion_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {OCCASION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date <span className="text-destructive">*</span></Label>
          <DatePicker value={form.occasion_date} onChange={(v) => set('occasion_date', v)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any notes..." />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Switch id="recurring" checked={form.recurring_yearly} onCheckedChange={(v) => set('recurring_yearly', v)} />
          <Label htmlFor="recurring" className="cursor-pointer">Recurring yearly</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="active" checked={form.active} onCheckedChange={(v) => set('active', v)} />
          <Label htmlFor="active" className="cursor-pointer">Active</Label>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Occasion'}
        </Button>
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
