'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from './DatePicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import type { Donation } from '@/lib/types';
import { DONATION_TYPES, FOOD_TYPES, PAYMENT_METHODS, formatCurrency, normalizeDonationType } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';

// food_quantity / food_description columns hold the item details for every donation type.
const QUANTITY_HINTS: Record<string, string> = {
  Food: 'e.g. 100 meals',
  Clothes: 'e.g. 50 sets',
  Education: 'e.g. 5 students',
  Groceries: 'e.g. 20 kits',
  'Books & Stationery': 'e.g. 30 kits',
  Money: 'e.g. 1 payment',
};

const DESCRIPTION_HINTS: Record<string, string> = {
  Food: 'e.g. South Indian thali for 100 people',
  Clothes: 'e.g. School uniforms and winter wear',
  Education: 'e.g. School fees for 5 children',
  Medical: 'e.g. Medicines and health check-up camp',
  Groceries: 'e.g. Monthly ration kits',
  'Books & Stationery': 'e.g. Notebooks, pens and bags',
  Money: 'e.g. General fund contribution',
};

interface DonationFormProps {
  sponsorId: string;
  sponsorName?: string;
  sponsorshipRequestId?: string;
  occasionId?: string;
  occasionName?: string;
  donation?: Donation;
  onSaved: (donation: Donation) => void;
  onCancel: () => void;
}

export function DonationForm({
  sponsorId, sponsorName, sponsorshipRequestId, occasionId, occasionName,
  donation, onSaved, onCancel,
}: DonationFormProps) {
  const { appUser } = useAuth();
  const isEdit = !!donation;

  const [form, setForm] = useState({
    donation_date: donation?.donation_date || new Date().toISOString().split('T')[0],
    type: normalizeDonationType(donation?.type),
    amount: donation?.amount?.toString() || '',
    food_type: donation?.food_type || '',
    food_quantity: donation?.food_quantity || '',
    people_helped: donation?.people_helped?.toString() || '',
    location: donation?.location || '',
    food_description: donation?.food_description || '',
    payment_method: donation?.payment_method || '',
    transaction_id: donation?.transaction_id || '',
    receipt_number: donation?.receipt_number || '',
    notes: donation?.notes || '',
    occasion_name: donation?.occasion_name || occasionName || '',
    status: donation?.status || 'completed',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const isFood = form.type === 'Food';
  const isMoney = form.type === 'Money';

  async function handleSubmit() {
    if (isMoney && (!form.amount || isNaN(Number(form.amount)))) { setError('Valid amount is required.'); return; }
    if (form.amount && isNaN(Number(form.amount))) { setError('Enter a valid value.'); return; }
    setBusy(true); setError('');

    const payload = {
      sponsor_id: sponsorId,
      sponsorship_request_id: sponsorshipRequestId || null,
      occasion_id: occasionId || null,
      occasion_name: form.occasion_name || null,
      donation_date: form.donation_date,
      type: form.type || null,
      amount: Number(form.amount) || 0,
      food_type: isFood ? form.food_type || null : null,
      food_quantity: form.food_quantity || null,
      people_helped: Number(form.people_helped) || 0,
      location: form.location || null,
      food_description: form.food_description || null,
      payment_method: form.payment_method || null,
      transaction_id: form.transaction_id || null,
      receipt_number: form.receipt_number || null,
      notes: form.notes || null,
      status: form.status,
      created_by: appUser?.id || null,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from('donations').update(payload).eq('id', donation!.id).select().single();
      setBusy(false);
      if (err) { setError('Unable to save donation. Please try again.'); return; }
      onSaved(data as Donation);
    } else {
      const { data, error: err } = await supabase
        .from('donations').insert(payload).select().single();
      setBusy(false);
      if (err) { setError('Unable to save donation. Please try again.'); return; }
      const newDonation = data as Donation;

      // Update sponsor totals
      const { data: sponsor } = await supabase.from('sponsors').select('total_donations,people_helped').eq('id', sponsorId).single();
      if (sponsor) {
        await supabase.from('sponsors').update({
          total_donations: Number(sponsor.total_donations || 0) + (Number(form.amount) || 0),
          people_helped: Number(sponsor.people_helped || 0) + Number(form.people_helped || 0),
          last_contact_date: form.donation_date,
        }).eq('id', sponsorId);
      }

      // Update sponsorship request status if linked
      if (sponsorshipRequestId) {
        await supabase.from('sponsorship_requests').update({ status: 'completed' }).eq('id', sponsorshipRequestId);
      }

      // Log interaction
      await supabase.from('interactions').insert({
        sponsor_id: sponsorId,
        type: 'other',
        summary: `${form.type} donation recorded${Number(form.amount) ? `: ${formatCurrency(Number(form.amount))}` : ''}`,
        details: `${[isFood ? form.food_type : '', form.food_quantity, form.food_description].filter(Boolean).join(' · ') || form.type} for ${form.people_helped || 0} people. ${form.occasion_name ? `Occasion: ${form.occasion_name}` : ''}`,
        interaction_date: new Date().toISOString(),
        conducted_by: appUser?.id || null,
      });

      onSaved(newDonation);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      {sponsorName && (
        <div className="p-3 rounded-lg bg-muted text-sm">
          <span className="text-muted-foreground">Sponsor: </span>
          <span className="font-medium">{sponsorName}</span>
          {form.occasion_name && <><span className="text-muted-foreground"> · Occasion: </span><span className="font-medium">{form.occasion_name}</span></>}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Donation Type</Label>
          <div className="flex flex-wrap gap-2">
            {DONATION_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={form.type === t ? 'default' : 'outline'}
                onClick={() => set('type', t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Donation Date</Label>
          <DatePicker value={form.donation_date} onChange={(v) => set('donation_date', v)} />
        </div>
        <div className="space-y-1.5">
          <Label>
            {isMoney ? <>Amount (₹) <span className="text-destructive">*</span></> : 'Estimated Value (₹)'}
          </Label>
          <Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder={isMoney ? '15000' : 'Optional'} />
        </div>
        <div className="space-y-1.5">
          <Label>Occasion</Label>
          <Input value={form.occasion_name} onChange={(e) => set('occasion_name', e.target.value)} placeholder="e.g. Birthday" />
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
          <Label>People Helped</Label>
          <Input type="number" value={form.people_helped} onChange={(e) => set('people_helped', e.target.value)} placeholder="100" />
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City / Venue" />
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method</Label>
          <Select value={form.payment_method} onValueChange={(v) => set('payment_method', v)}>
            <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Transaction / Reference ID</Label>
          <Input value={form.transaction_id} onChange={(e) => set('transaction_id', e.target.value)} placeholder="TXN123" />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Number</Label>
          <Input value={form.receipt_number} onChange={(e) => set('receipt_number', e.target.value)} placeholder="RCPT001" />
        </div>
        <div className="space-y-1.5">
          <Label>{isFood ? 'Food Quantity' : 'Quantity'}</Label>
          <Input value={form.food_quantity} onChange={(e) => set('food_quantity', e.target.value)} placeholder={QUANTITY_HINTS[form.type] || 'e.g. 10 items'} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{isFood ? 'Food Description' : 'Description'}</Label>
          <Input value={form.food_description} onChange={(e) => set('food_description', e.target.value)} placeholder={DESCRIPTION_HINTS[form.type] || 'What was donated?'} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any additional notes..." />
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : isEdit ? 'Save Changes' : 'Record Donation'}
        </Button>
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
