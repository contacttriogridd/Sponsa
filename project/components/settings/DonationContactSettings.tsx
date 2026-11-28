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
import { clearAckContext } from '@/components/shared/AcknowledgmentButton';
import { clearWishContext } from '@/lib/star-wish';
import { PhoneInput, phoneForSave } from '@/components/shared/PhoneInput';

/**
 * Settings: who gets the acknowledgment for every donation (Udhaya Sir), and
 * the UPI / bank / contact details used in the Monthly Sponsorship Request.
 */
export function DonationContactSettings() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [orgId, setOrgId] = useState<string | null>(null);
  const [form, setForm] = useState({ ack_name: '', ack_whatsapp: '', ack_email: '', payment_details: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('organization_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (!data) return;
      const r = ackRecipientFrom(data);
      setOrgId(data.id);
      setForm({ ack_name: r.name, ack_whatsapp: r.whatsapp, ack_email: r.email, payment_details: data.payment_details || '' });
    });
  }, []);

  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setStatus(null); };

  async function save() {
    if (!orgId) { setStatus({ ok: false, text: 'Save the main Settings once first.' }); return; }
    const number = phoneForSave(form.ack_whatsapp).value;
    if (!number) { setStatus({ ok: false, text: 'Acknowledgment WhatsApp: enter a valid 10-digit mobile number.' }); return; }
    if (form.ack_email.trim() && !/^\S+@\S+\.\S+$/.test(form.ack_email.trim())) { setStatus({ ok: false, text: 'Enter a valid email, or leave it empty.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('organization_settings').update({
      ack_name: form.ack_name.trim() || 'Udhaya Sir', ack_whatsapp: number, ack_email: form.ack_email.trim() || null,
      payment_details: form.payment_details.trim() || null,
    }).eq('id', orgId);
    setBusy(false);
    if (error) { setStatus({ ok: false, text: error.code === 'PGRST204' ? 'These settings need database migrations 00028 and 00031 first.' : 'Unable to save. Please try again.' }); return; }
    clearAckContext(); clearWishContext();
    setStatus({ ok: true, text: 'Saved.' });
  }

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Donation acknowledgment & payment details</h2>
        <p className="text-sm text-muted-foreground mt-1">Every recorded donation sends an acknowledgment to this person. The payment details fill {'{{payment_details}}'} in the Monthly Sponsorship Request; when empty, that line is left out.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ack-name">Acknowledgment recipient</Label>
          <Input id="ack-name" value={form.ack_name} onChange={(e) => set('ack_name', e.target.value)} disabled={!isAdmin} placeholder="Udhaya Sir" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ack-wa">WhatsApp number</Label>
          <PhoneInput id="ack-wa" value={form.ack_whatsapp} onChange={(v) => set('ack_whatsapp', v)} disabled={!isAdmin} placeholder="96295 22777" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ack-email">Email (optional)</Label>
          <Input id="ack-email" type="email" value={form.ack_email} onChange={(e) => set('ack_email', e.target.value)} disabled={!isAdmin} placeholder="name@example.com" />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="payment-details">Donation payment details</Label>
          <Textarea id="payment-details" rows={4} value={form.payment_details} onChange={(e) => set('payment_details', e.target.value)} disabled={!isAdmin}
            placeholder={'UPI: vptrust@upi\nA/c name: VP TRUST · A/c no: 1234567890 · IFSC: ABCD0123456\nor a payment link'} />
        </div>
      </div>
      {status && <p className={status.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{status.text}</p>}
      {isAdmin
        ? <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save'}</Button>
        : <p className="text-xs text-muted-foreground">Only an admin can change these.</p>}
    </Card>
  );
}
