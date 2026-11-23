'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, IndianRupee, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { RAASIS, STARS } from '@/lib/natchathiram';
import { monthKey, shiftMonth, todayIst } from '@/lib/monthly-sponsors';
import type { Donation, MonthlyPayment, MonthlySponsor } from '@/lib/types';
import { donationMonth, sumDonations } from '@/lib/donations';
import { downloadCsv } from '@/lib/export-download';
import { ddmmyyyy, exportPhone, plainAmount } from '@/lib/export';
import { AMOUNT_NOT_SET, AMOUNT_NOT_SET_EN, amountLabel } from '@/lib/amount';

interface MonthTotal { month: string; collected: number; pending: number }


const monthLabel = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Reports section: this month's monthly-sponsor collection and the last six months. */
export function MonthlySponsorsReport() {
  const [sponsors, setSponsors] = useState<MonthlySponsor[] | null>(null);
  const [months, setMonths] = useState<MonthTotal[]>([]);

  useEffect(() => {
    (async () => {
      const thisMonth = monthKey(todayIst());
      const from = shiftMonth(thisMonth, -5);
      const [{ data, error }, { data: payments }, { data: dons }] = await Promise.all([
        supabase.from('monthly_sponsors').select('*'),
        supabase.from('monthly_payments').select('*').gte('month', from).lte('month', thisMonth),
        // Collected = monthly sponsors' donation rows (Mark paid writes one too), by the month they are for.
        supabase.from('donations').select('*').not('monthly_sponsor_id', 'is', null).gte('donation_date', shiftMonth(from, -2)),
      ]);
      if (error) return; // migration 00011 not applied yet: hide the section
      const list = (data || []) as MonthlySponsor[];
      const pays = (payments || []) as MonthlyPayment[];
      const donations = (dons || []) as Donation[];
      const active = list.filter((s) => s.status === 'active');
      setSponsors(list);
      setMonths(Array.from({ length: 6 }, (_, i) => shiftMonth(from, i)).map((month) => {
        const ofMonth = pays.filter((p) => p.month === month);
        const donated = donations.filter((d) => donationMonth(d) === month);
        const paidIds = new Set([...ofMonth.filter((p) => p.status === 'paid').map((p) => p.monthly_sponsor_id), ...donated.map((d) => d.monthly_sponsor_id!)]);
        return {
          month,
          collected: sumDonations(donated),
          pending: active.filter((s) => !paidIds.has(s.id)).reduce((a, s) => a + Number(s.monthly_amount || 0), 0),
        };
      }).reverse());
    })();
  }, []);

  async function exportPayments() {
    const { data } = await supabase
      .from('monthly_payments')
      .select('*, monthly_sponsors(name)')
      .order('month', { ascending: false });
    downloadCsv([
      ['Month', 'Sponsor', 'Amount (₹)', 'Status', 'Paid On', 'Mode', 'Notes'],
      ...(data || []).map((p: any) => [monthLabel(p.month), p.monthly_sponsors?.name, p.amount != null ? plainAmount(p.amount) : '', p.status, ddmmyyyy(p.paid_on), p.mode, p.notes]),
    ], 'monthly-payments.csv');
  }


  async function exportSponsors() {
    downloadCsv([
      ['Name', 'Phone', 'Date of Birth', 'Raasi', 'Star', 'Monthly Amount (₹)', 'Payment Day', 'Start Date', 'Status', 'Notes'],
      ...(sponsors || []).filter((s) => !s.deleted_at).map((s) => [
        s.name, exportPhone(s.phone), ddmmyyyy(s.dob),
        s.raasi != null ? `${RAASIS[s.raasi].ta} (${RAASIS[s.raasi].en})` : '',
        s.star != null ? `${STARS[s.star].ta} (${STARS[s.star].en})` : '',
        s.monthly_amount != null ? plainAmount(s.monthly_amount) : AMOUNT_NOT_SET_EN, s.payment_day ?? '', ddmmyyyy(s.start_date), s.status, s.notes,
      ]),
    ], 'monthly-sponsors.csv');
  }


  if (!sponsors) return null;
  const active = sponsors.filter((s) => s.status === 'active');
  const expected = active.reduce((a, s) => a + Number(s.monthly_amount || 0), 0);
  const current = months[0];
  const metrics = [
    { label: 'Monthly Sponsors', value: active.length, sub: `${sponsors.length} in total`, icon: Users, color: 'text-primary' },
    { label: 'Monthly Collection', value: formatCurrency(expected), sub: 'Expected each month', icon: IndianRupee, color: 'text-warning' },
    { label: 'Collected', value: formatCurrency(current?.collected || 0), sub: current ? monthLabel(current.month) : '', icon: CheckCircle2, color: 'text-success' },
    { label: 'Pending', value: formatCurrency(current?.pending || 0), sub: current ? monthLabel(current.month) : '', icon: Clock, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Monthly Sponsors</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
                  <p className="text-xl font-bold mt-1">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
                </div>
                <div className={`p-2 rounded-lg bg-muted ${m.color}`}><Icon className="h-4 w-4" /></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Last 6 months</div>
        <div className="divide-y divide-border text-sm">
          {months.map((m) => (
            <div key={m.month} className="flex items-center justify-between py-2">
              <span>{monthLabel(m.month)}</span>
              <span className="text-success">{formatCurrency(m.collected)} collected</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Monthly Sponsor Report</div>
            <div className="text-sm text-muted-foreground">Names, Raasi, star and monthly amounts</div>
          </div>
          <Button variant="outline" size="sm" onClick={exportSponsors}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
        </Card>
        <Card className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Monthly Payment Report</div>
            <div className="text-sm text-muted-foreground">Every month&apos;s Paid / Pending with date and mode</div>
          </div>
          <Button variant="outline" size="sm" onClick={exportPayments}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
        </Card>
      </div>
    </div>
  );
}
