'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface SponsorFormProps {
  sponsor?: Sponsor;
  onSaved?: (sponsor: Sponsor) => void;
}

export function SponsorForm({ sponsor, onSaved }: SponsorFormProps) {
  const router = useRouter();
  const { appUser } = useAuth();
  const isEdit = !!sponsor;

  const [form, setForm] = useState({
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
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Sponsor[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function checkDuplicates(): Promise<Sponsor[]> {
    const name = form.full_name.trim();
    if (!form.phone && !form.whatsapp && !form.email && !name) return [];

    const conditions: string[] = [];
    if (form.phone) conditions.push(`phone.eq.${form.phone}`, `whatsapp.eq.${form.phone}`);
    if (form.whatsapp) conditions.push(`phone.eq.${form.whatsapp}`, `whatsapp.eq.${form.whatsapp}`);
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
      full_name: form.full_name.trim(),
      preferred_name: form.preferred_name || null,
      dob: form.dob || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
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
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('sponsors')
        .update(payload)
        .eq('id', sponsor!.id)
        .select()
        .single();
      setBusy(false);
      if (err) { setError('Unable to save sponsor. Please try again.'); return; }
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
      onSaved?.(data as Sponsor);
    } else {
      const { data, error: err } = await supabase
        .from('sponsors')
        .insert(payload)
        .select()
        .single();
      setBusy(false);
      if (err) { setError('Unable to save sponsor. Please try again.'); return; }
      const newSponsor = data as Sponsor;
      // Auto-create birthday occasion from DOB
      if (form.dob) {
        await supabase.from('special_occasions').insert({
          sponsor_id: newSponsor.id,
          person_name: form.full_name.trim(),
          relationship: 'Self',
          occasion_type: 'Birthday',
          occasion_date: form.dob,
          recurring_yearly: true,
          is_auto_generated: true,
          active: true,
        });
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
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
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
            <Input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
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
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="+91 98765 43210" />
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
        <Button onClick={() => handleSubmit()} disabled={busy} className="flex-1 sm:flex-none sm:min-w-32">
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sponsor'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
