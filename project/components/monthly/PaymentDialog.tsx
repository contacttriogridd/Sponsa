'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/shared/DatePicker';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { todayIst } from '@/lib/monthly-sponsors';
import type { MonthlyPayment, MonthlySponsor, PaymentMode } from '@/lib/types';

const MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank'];

interface PaymentDialogProps {
  sponsor: MonthlySponsor | null;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  payment?: MonthlyPayment;
  onOpenChange: (open: boolean) => void;
  onSaved: (payment: MonthlyPayment) => void;
}

/** Records a month's contribution as Paid (date, mode, amount) or sets it back to Pending. */
export function PaymentDialog({ sponsor, month, payment, onOpenChange, onSaved }: PaymentDialogProps) {
  const { appUser } = useAuth();
  const [status, setStatus] = useState<'paid' | 'pending'>('paid');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [mode, setMode] = useState<PaymentMode>('Cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sponsor) return;
    setStatus(payment?.status === 'pending' ? 'pending' : 'paid');
    setAmount(String(payment?.amount ?? sponsor.monthly_amount ?? ''));
    setPaidOn(payment?.paid_on || todayIst());
    setMode(payment?.mode || 'Cash');
    setError('');
  }, [sponsor, payment]);

  async function save() {
    if (!sponsor) return;
    setBusy(true); setError('');
    const paid = status === 'paid';
    const { data, error: err } = await supabase
      .from('monthly_payments')
      .upsert({
        monthly_sponsor_id: sponsor.id,
        month,
        amount: amount ? Number(amount) : null,
        status,
        paid_on: paid ? paidOn || null : null,
        mode: paid ? mode : null,
        recorded_by: appUser?.id || null,
      }, { onConflict: 'monthly_sponsor_id,month' })
      .select()
      .single();
    setBusy(false);
    if (err) { setError('Unable to save. Please try again.'); return; }
    onSaved(data as MonthlyPayment);
    onOpenChange(false);
  }

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <Dialog open={!!sponsor} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{sponsor?.name} — {monthLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'paid' | 'pending')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input id="pay-amount" type="number" min="0" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {status === 'paid' && (
              <>
                <div className="space-y-1.5">
                  <Label>Payment date</Label>
                  <DatePicker value={paidOn} onChange={setPaidOn} fromYear={2020} toYear={new Date().getFullYear() + 1} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
