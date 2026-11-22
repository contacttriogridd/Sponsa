'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { buildMonthlyReport, type ReportDonation } from '@/lib/export';
import { downloadMonthlyReportCsv, downloadMonthlyReportXlsx } from '@/lib/export-download';
import { todayIst } from '@/lib/monthly-sponsors';
import type { MessageLog } from '@/lib/types';

const PAGE = 1000;

/** Every donation dated in the month (all pages, not just what is on screen), with sponsor names and phones. */
async function loadMonth(month: string): Promise<{ donations: ReportDonation[]; logs: MessageLog[] }> {
  const [y, m] = month.split('-').map(Number);
  const last = `${month.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const donations: ReportDonation[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('donations')
      .select('*, sponsors(full_name, phone, whatsapp), monthly_sponsors(name, phone)')
      .gte('donation_date', `${month.slice(0, 8)}01`).lte('donation_date', last)
      .order('donation_date').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    donations.push(...((data || []) as ReportDonation[]));
    if (!data || data.length < PAGE) break;
  }
  const logs: MessageLog[] = [];
  const ids = donations.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('message_logs').select('*').eq('message_type', 'donation_thanks').in('related_donation_id', ids.slice(i, i + 200));
    logs.push(...((data || []) as MessageLog[]));
  }
  return { donations, logs };
}

/** "Monthly Donation Report": pick a month, download Excel (.xlsx) or an Excel-safe CSV. */
export function MonthlyReportDownload({ compact = false }: { compact?: boolean }) {
  const { appUser } = useAuth();
  const [month, setMonth] = useState(todayIst().slice(0, 7));
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null);

  async function download(kind: 'xlsx' | 'csv') {
    if (!/^\d{4}-\d{2}$/.test(month)) { toast.error('Choose a month.'); return; }
    setBusy(kind);
    try {
      const { donations, logs } = await loadMonth(`${month}-01`);
      const report = buildMonthlyReport(donations, logs, `${month}-01`, appUser?.full_name || appUser?.email || '');
      if (kind === 'xlsx') await downloadMonthlyReportXlsx(report); else downloadMonthlyReportCsv(report);
      toast.success(`${report.count} donation${report.count === 1 ? '' : 's'} · total ₹${report.total.toLocaleString('en-IN')}`);
    } catch {
      toast.error('Unable to build the report. Please try again.');
    }
    setBusy(null);
  }

  return (
    <div className={compact ? 'flex flex-wrap items-end gap-2' : 'flex flex-col sm:flex-row sm:items-end gap-3'}>
      <div className="space-y-1.5">
        <Label htmlFor="report-month">Month</Label>
        <Input id="report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
      </div>
      <Button onClick={() => download('xlsx')} disabled={!!busy}>
        <FileSpreadsheet className="h-4 w-4 mr-1.5" />{busy === 'xlsx' ? 'Preparing…' : 'Download Excel (.xlsx)'}
      </Button>
      <Button variant="outline" onClick={() => download('csv')} disabled={!!busy}>
        <Download className="h-4 w-4 mr-1.5" />{busy === 'csv' ? 'Preparing…' : 'Download CSV'}
      </Button>
    </div>
  );
}
