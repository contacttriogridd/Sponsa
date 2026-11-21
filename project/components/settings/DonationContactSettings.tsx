'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { ackRecipientFrom } from '@/lib/acknowledgment';
import { normalizeIndianNumber } from '@/lib/phone';
import { clearAckContext } from '@/components/shared/AcknowledgmentButton';
import { clearWishContext } from '@/lib/star-wish';

/**
 * Settings: who gets the acknowledgment for every donation (Udhaya Sir), and
 * the UPI / bank / contact details used in the Monthly Sponsorship Request.
 */
export function DonationContactSettings() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [orgId, setOrgId] = useState<string | null>(null);
  const [form, setForm] = useState({ ack_name: '', ack_whatsapp: '', ack_email: '', upi_id: '', bank_details: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('organization_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (!data) return;
      const r = ackRecipientFrom(data);
      setOrgId(data.id);
      setForm({ ack_name: r.name, ack_whatsapp: r.whatsapp.replace(/^91/, ''), ack_email: r.email, upi_id: data.upi_id || '', bank_details: data.bank_details || '' });
    });
  }, []);

  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setStatus(null); };

  async function save() {
    if (!orgId) { setStatus({ ok: false, text: 'Save the main Settings once first.' }); return; }
    const number = normalizeIndianNumber(form.ack_whatsapp);
    if (!number) { setStatus({ ok: false, text: 'Acknowledgment WhatsApp must be a 10-digit Indian mobile number.' }); return; }
    if (form.ack_email.trim() && !/^\S+@\S+\.\S+$/.test(form.ack_email.trim())) { setStatus({ ok: false, text: 'Enter a valid email, or leave it empty.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('organization_settings').update({
      ack_name: form.ack_name.trim() || 'Udhaya Sir', ack_whatsapp: number, ack_email: form.ack_email.trim() || null,
      upi_id: form.upi_id.trim() || null, bank_details: form.bank_details.trim() || null,
    }).eq('id', orgId);
    setBusy(false);
    if (error) { setStatus({ ok: false, text: error.code === 'PGRST204' ? 'These settings need database migration 00028 first.' : 'Unable to save. Please try again.' }); return; }
    clearAckContext(); clearWishContext();
    setStatus({ ok: true, text: 'Saved.' });
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Donation acknowledgment & payment details</h2>
        <p className="text-sm text-muted-foreground mt-1">Every recorded donation sends an acknowledgment to this person. UPI, bank and contact details fill the Monthly Sponsorship Request.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ack-name">Acknowledgment recipient</Label>
          <Input id="ack-name" value={form.ack_name} onChange={(e) => set('ack_name', e.target.value)} disabled={!isAdmin} placeholder="Udhaya Sir" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ack-wa">WhatsApp number</Label>
          <Input id="ack-wa" inputMode="tel" value={form.ack_whatsapp} onChange={(e) => set('ack_whatsapp', e.target.value)} disabled={!isAdmin} placeholder="9629522777" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ack-email">Email (optional)</Label>
          <Input id="ack-email" type="email" value={form.ack_email} onChange={(e) => set('ack_email', e.target.value)} disabled={!isAdmin} placeholder="name@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="upi">UPI ID</Label>
          <Input id="upi" value={form.upi_id} onChange={(e) => set('upi_id', e.target.value)} disabled={!isAdmin} placeholder="vptrust@upi" />
        </div>
        <p className="sm:col-span-2 self-end text-xs text-muted-foreground">{'{{contact_number}}'} is the organization phone in Organization Details.</p>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="bank">Bank details</Label>
          <Textarea id="bank" rows={2} value={form.bank_details} onChange={(e) => set('bank_details', e.target.value)} disabled={!isAdmin} placeholder="A/c name, A/c no, IFSC, bank & branch" />
        </div>
      </div>
      {status && <p className={status.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{status.text}</p>}
      {isAdmin
        ? <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save'}</Button>
        : <p className="text-xs text-muted-foreground">Only an admin can change these.</p>}
    </Card>
  );
}
