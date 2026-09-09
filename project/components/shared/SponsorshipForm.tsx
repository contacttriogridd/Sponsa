'use client';

import { useState } from 'react';
import { Save, X, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Sponsor, SponsorshipRequest, SpecialOccasion } from '@/lib/types';
import { FOOD_TYPES, SPONSORSHIP_STATUSES, SPONSORSHIP_STATUS_LABELS, formatDateShort } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { useAuth } from '@/lib/auth-context';

interface SponsorshipFormProps {
  sponsor: Sponsor;
  occasion?: SpecialOccasion;
  request?: SponsorshipRequest;
  onSaved: (request: SponsorshipRequest) => void;
  onCancel: () => void;
}

export function SponsorshipForm({ sponsor, occasion, request, onSaved, onCancel }: SponsorshipFormProps) {
  const { appUser } = useAuth();
  const isEdit = !!request;

  const nextDate = occasion?.occasion_date
    ? new Date(occasion.occasion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
    : '';

  const defaultMessage = `Dear ${sponsor.preferred_name || sponsor.full_name},

Your ${occasion?.occasion_type || 'special day'} is coming up${nextDate ? ` on ${nextDate}` : ''}. We would like to wish you in advance and invite you to celebrate your special day by sponsoring food for people who are in need.

Your kindness can bring happiness and nourishment to someone who truly needs it.

Thank you for your support.

Warm regards,
Sponsa`;

  const [form, setForm] = useState({
    occasion_name: request?.occasion_name || occasion?.occasion_type || '',
    special_date: request?.special_date || occasion?.occasion_date || '',
    requested_amount: request?.requested_amount?.toString() || '',
    food_type: request?.food_type || '',
    people_count: request?.people_count?.toString() || '',
    status: request?.status || 'draft',
    notes: request?.notes || '',
    message: defaultMessage,
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    setBusy(true); setError('');

    const payload = {
      sponsor_id: sponsor.id,
      occasion_id: occasion?.id || null,
      occasion_name: form.occasion_name || null,
      special_date: form.special_date || null,
      requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
      food_type: form.food_type || null,
      people_count: form.people_count ? Number(form.people_count) : null,
      status: form.status,
      collector_id: appUser?.id || null,
      notes: form.notes || null,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('sponsorship_requests').update(payload).eq('id', request!.id).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      onSaved(data as SponsorshipRequest);
    } else {
      const { data, error: err } = await supabase
        .from('sponsorship_requests').insert(payload).select().single();
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      const newRequest = data as SponsorshipRequest;

      // Log interaction
      await supabase.from('interactions').insert({
        sponsor_id: sponsor.id,
        type: 'other',
        summary: `Sponsorship request created for ${form.occasion_name || 'occasion'}`,
        interaction_date: new Date().toISOString(),
        conducted_by: appUser?.id || null,
      });

      // Update sponsor last contact
      await supabase.from('sponsors').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', sponsor.id);

      onSaved(newRequest);
    }
  }

  async function markContacted() {
    set('status', 'contacted');
    if (isEdit && request) {
      await supabase.from('sponsorship_requests').update({ status: 'contacted' }).eq('id', request.id);
    }
    await supabase.from('sponsors').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', sponsor.id);
    await supabase.from('interactions').insert({
      sponsor_id: sponsor.id,
      type: 'whatsapp',
      summary: 'Sponsorship request sent via WhatsApp',
      interaction_date: new Date().toISOString(),
      conducted_by: appUser?.id || null,
    });
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-1">
        <div className="font-semibold">{sponsor.full_name}</div>
        {occasion && (
          <div className="text-sm text-muted-foreground">
            {occasion.occasion_type} · {formatDateShort(occasion.occasion_date)}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Occasion</Label>
          <Input value={form.occasion_name} onChange={(e) => set('occasion_name', e.target.value)} placeholder="e.g. Birthday" />
        </div>
        <div className="space-y-1.5">
          <Label>Special Date</Label>
          <Input type="date" value={form.special_date} onChange={(e) => set('special_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Requested Amount (₹)</Label>
          <Input type="number" value={form.requested_amount} onChange={(e) => set('requested_amount', e.target.value)} placeholder="15000" />
        </div>
        <div className="space-y-1.5">
          <Label>Food Type</Label>
          <Select value={form.food_type} onValueChange={(v) => set('food_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select food type" /></SelectTrigger>
            <SelectContent>
              {FOOD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Number of People</Label>
          <Input type="number" value={form.people_count} onChange={(e) => set('people_count', e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPONSORSHIP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{SPONSORSHIP_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any notes..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Suggested Message</Label>
        <Textarea
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          rows={8}
          className="text-sm font-mono"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSubmit} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Request'}
        </Button>
        {sponsor.whatsapp && (
          <a
            href={buildWhatsAppUrl(sponsor.whatsapp, form.message)}
            target="_blank"
            rel="noreferrer"
            onClick={markContacted}
          >
            <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
              <MessageCircle className="h-4 w-4 mr-2" />
              Send WhatsApp
            </Button>
          </a>
        )}
        {sponsor.phone && (
          <a href={`tel:${sponsor.phone}`}>
            <Button variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Call
            </Button>
          </a>
        )}
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
