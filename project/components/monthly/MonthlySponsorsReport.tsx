'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, IndianRupee, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { RAASIS, STARS } from '@/lib/natchathiram';
import { monthKey, shiftMonth, todayIst } from '@/lib/monthly-sponsors';
import type { MonthlyPayment, MonthlySponsor } from '@/lib/types';

interface MonthTotal { month: string; collected: number; pending: number }

/** CSV with a UTF-8 byte-order mark so Excel shows Tamil names correctly. */
function downloadUtf8Csv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const monthLabel = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Reports section: this month's monthly-sponsor collection and the last six months. */
export function MonthlySponsorsReport() {
  const [sponsors, setSponsors] = useState<MonthlySponsor[] | null>(null);
  const [months, setMonths] = useState<MonthTotal[]>([]);

  useEffect(() => {
    (async () => {
      const thisMonth = monthKey(todayIst());
      const from = shiftMonth(thisMonth, -5);
      const [{ data, error }, { data: payments }] = await Promise.all([
        supabase.from('monthly_sponsors').select('*'),
        supabase.from('monthly_payments').select('*').gte('month', from).lte('month', thisMonth),
      ]);
      if (error) return; // migration 00011 not applied yet: hide the section
      const list = (data || []) as MonthlySponsor[];
      const pays = (payments || []) as MonthlyPayment[];
      const active = list.filter((s) => s.status === 'active');
      setSponsors(list);
      setMonths(Array.from({ length: 6 }, (_, i) => shiftMonth(from, i)).map((month) => {
        const ofMonth = pays.filter((p) => p.month === month);
        const paidIds = new Set(ofMonth.filter((p) => p.status === 'paid').map((p) => p.monthly_sponsor_id));
        return {
          month,
          collected: ofMonth.filter((p) => p.status === 'paid').reduce((a, p) => a + Number(p.amount || 0), 0),
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
    downloadUtf8Csv((data || []).map((p: any) => ({
      month: p.month, sponsor: p.monthly_sponsors?.name, amount: p.amount, status: p.status, paid_on: p.paid_on, mode: p.mode, notes: p.notes,
    })), 'monthly-payments.csv');
  }

  async function exportSponsors() {
    downloadUtf8Csv((sponsors || []).map((s) => ({
      name: s.name, phone: s.phone, dob: s.dob,
      raasi: s.raasi != null ? `${RAASIS[s.raasi].ta} (${RAASIS[s.raasi].en})` : '',
      star: s.star != null ? `${STARS[s.star].ta} (${STARS[s.star].en})` : '',
      monthly_amount: s.monthly_amount, payment_day: s.payment_day, start_date: s.start_date, status: s.status, notes: s.notes,
    })), 'monthly-sponsors.csv');
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
