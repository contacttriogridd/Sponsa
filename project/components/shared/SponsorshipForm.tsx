'use client';

import { useState } from 'react';
import { Save, X, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Sponsor, SponsorshipRequest, SpecialOccasion } from '@/lib/types';
import { DONATION_TYPES, FOOD_TYPES, SPONSORSHIP_STATUSES, SPONSORSHIP_STATUS_LABELS, formatDateShort, normalizeDonationType } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { useAuth } from '@/lib/auth-context';

// How each request type is described in the suggested WhatsApp message.
const REQUEST_PHRASES: Record<string, string> = {
  Food: 'sponsoring food for people who are in need',
  Money: 'contributing to our fund for people who are in need',
  Clothes: 'sponsoring clothes for people who are in need',
  Education: 'supporting the education of children who are in need',
  Medical: 'supporting medical care for people who are in need',
  Groceries: 'sponsoring groceries for families who are in need',
  'Books & Stationery': 'sponsoring books and stationery for children who are in need',
};

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

  const isRemembrance = occasion?.occasion_type === 'Death Anniversary';
  const whose = occasion && occasion.relationship && occasion.relationship !== 'Self'
    ? `the death anniversary of your ${occasion.relationship.toLowerCase()}, ${occasion.person_name},`
    : `the death anniversary of ${occasion?.person_name || 'your loved one'}`;

  const buildMessage = (type: string) => isRemembrance ? `Dear ${sponsor.preferred_name || sponsor.full_name},

We remember with you that ${whose} falls${nextDate ? ` on ${nextDate}` : ' soon'}. If you wish, you can honour their memory by ${REQUEST_PHRASES[type] || 'supporting people who are in need'}.

Your kindness can bring ${type === 'Food' ? 'nourishment' : 'hope'} to someone who truly needs it.

With respect,
VP Trust` : `Dear ${sponsor.preferred_name || sponsor.full_name},

Your ${occasion?.occasion_type || 'special day'} is coming up${nextDate ? ` on ${nextDate}` : ''}. We would like to wish you in advance and invite you to celebrate your special day by ${REQUEST_PHRASES[type] || 'supporting people who are in need'}.

Your kindness can bring happiness and ${type === 'Food' ? 'nourishment' : 'hope'} to someone who truly needs it.

Thank you for your support.

Warm regards,
VP Trust`;

  const initialType = normalizeDonationType(request?.type);

  const [form, setForm] = useState({
    type: initialType,
    occasion_name: request?.occasion_name || occasion?.occasion_type || '',
    special_date: request?.special_date || occasion?.occasion_date || '',
    requested_amount: request?.requested_amount?.toString() || '',
    food_type: request?.food_type || '',
    people_count: request?.people_count?.toString() || '',
    status: request?.status || 'draft',
    notes: request?.notes || '',
    message: buildMessage(initialType),
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [messageEdited, setMessageEdited] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const isFood = form.type === 'Food';

  // Keep the suggested message in step with the type until the collector edits it by hand.
  function setType(type: string) {
    setForm((f) => ({ ...f, type, ...(messageEdited ? {} : { message: buildMessage(type) }) }));
  }

  /**
   * Saves the request. If the database hasn't had migration 00006 applied yet
   * (no `type` column), retries without it so saving never breaks.
   */
  async function save(payload: Record<string, unknown>) {
    const run = (p: Record<string, unknown>) => isEdit
      ? supabase.from('sponsorship_requests').update(p).eq('id', request!.id).select().single()
      : supabase.from('sponsorship_requests').insert(p).select().single();
    const result = await run(payload);
    if (result.error?.code === 'PGRST204' && result.error.message.includes("'type'")) {
      const { type: _omit, ...rest } = payload;
      return run(rest);
    }
    return result;
  }

  async function handleSubmit() {
    setBusy(true); setError('');

    const payload = {
      sponsor_id: sponsor.id,
      occasion_id: occasion?.id || null,
      type: form.type,
      occasion_name: form.occasion_name || null,
      special_date: form.special_date || null,
      requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
      food_type: isFood ? form.food_type || null : null,
      people_count: form.people_count ? Number(form.people_count) : null,
      status: form.status,
      collector_id: appUser?.id || null,
      notes: form.notes || null,
    };

    const { data, error: err } = await save(payload);
    if (isEdit) {
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      onSaved(data as SponsorshipRequest);
    } else {
      setBusy(false);
      if (err) { setError('Unable to save. Please try again.'); return; }
      const newRequest = data as SponsorshipRequest;

      // Log interaction
      await supabase.from('interactions').insert({
        sponsor_id: sponsor.id,
        type: 'other',
        summary: `${form.type} sponsorship request created for ${form.occasion_name || 'occasion'}`,
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Sponsorship Type</Label>
          <div className="flex flex-wrap gap-2">
            {DONATION_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={form.type === t ? 'default' : 'outline'}
                onClick={() => setType(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Occasion</Label>
          <Input value={form.occasion_name} onChange={(e) => set('occasion_name', e.target.value)} placeholder="e.g. Birthday" />
        </div>
        <div className="space-y-1.5">
          <Label>Special Date</Label>
          <DatePicker value={form.special_date} onChange={(v) => set('special_date', v)} />
        </div>
        <div className="space-y-1.5">
          <Label>{form.type === 'Money' ? 'Requested Amount (₹)' : 'Estimated Value (₹)'}</Label>
          <Input type="number" value={form.requested_amount} onChange={(e) => set('requested_amount', e.target.value)} placeholder={form.type === 'Money' ? '15000' : 'Optional'} />
        </div>
        {isFood && <div className="space-y-1.5">
          <Label>Food Type</Label>
          <Select value={form.food_type} onValueChange={(v) => set('food_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select food type" /></SelectTrigger>
            <SelectContent>
              {FOOD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>}
        <div className="space-y-1.5">
          <Label>People to Help</Label>
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
          onChange={(e) => { setMessageEdited(true); set('message', e.target.value); }}
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
