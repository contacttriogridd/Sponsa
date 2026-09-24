'use client';

import { useEffect, useState } from 'react';
import { Download, BarChart3, Users, Gift, HandHeart } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/constants';

interface ReportData {
  totalSponsors: number;
  activeSponsors: number;
  totalDonations: number;
  totalAmount: number;
  totalPeople: number;
  monthlyAmount: number;
  yearlyAmount: number;
  confirmedRequests: number;
  completedRequests: number;
  declinedRequests: number;
}

function downloadCSV(data: any[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

      const [sponsors, donations, requests, monthDon, yearDon] = await Promise.all([
        supabase.from('sponsors').select('id,status'),
        supabase.from('donations').select('amount,people_helped'),
        supabase.from('sponsorship_requests').select('status'),
        supabase.from('donations').select('amount').gte('donation_date', monthStart),
        supabase.from('donations').select('amount').gte('donation_date', yearStart),
      ]);

      const allSponsors = sponsors.data || [];
      const allDonations = donations.data || [];
      const allRequests = requests.data || [];

      setReport({
        totalSponsors: allSponsors.length,
        activeSponsors: allSponsors.filter((s) => s.status === 'active').length,
        totalDonations: allDonations.length,
        totalAmount: allDonations.reduce((a, d) => a + Number(d.amount || 0), 0),
        totalPeople: allDonations.reduce((a, d) => a + Number(d.people_helped || 0), 0),
        monthlyAmount: (monthDon.data || []).reduce((a, d) => a + Number(d.amount || 0), 0),
        yearlyAmount: (yearDon.data || []).reduce((a, d) => a + Number(d.amount || 0), 0),
        confirmedRequests: allRequests.filter((r) => r.status === 'confirmed').length,
        completedRequests: allRequests.filter((r) => r.status === 'completed').length,
        declinedRequests: allRequests.filter((r) => r.status === 'declined').length,
      });
      setLoading(false);
    })();
  }, []);

  async function exportSponsors() {
    const { data } = await supabase.from('sponsors').select('*').order('full_name');
    if (data) downloadCSV(data, 'sponsors.csv');
  }

  async function exportDonations() {
    const { data } = await supabase
      .from('donations')
      .select('*, sponsors(full_name)')
      .order('donation_date', { ascending: false });
    if (data) {
      const flat = data.map((d) => ({ ...d, sponsor_name: (d.sponsors as any)?.full_name, sponsors: undefined }));
      downloadCSV(flat, 'donations.csv');
    }
  }

  async function exportSponsorships() {
    const { data } = await supabase
      .from('sponsorship_requests')
      .select('*, sponsors(full_name)')
      .order('created_at', { ascending: false });
    if (data) {
      const flat = data.map((r) => ({ ...r, sponsor_name: (r.sponsors as any)?.full_name, sponsors: undefined }));
      downloadCSV(flat, 'sponsorships.csv');
    }
  }

  async function exportOccasions() {
    const { data } = await supabase
      .from('special_occasions')
      .select('*, sponsors(full_name)')
      .order('occasion_date');
    if (data) {
      const flat = data.map((o) => ({ ...o, sponsor_name: (o.sponsors as any)?.full_name, sponsors: undefined }));
      downloadCSV(flat, 'occasions.csv');
    }
  }

  const metrics = report ? [
    { label: 'Total Sponsors', value: report.totalSponsors, sub: `${report.activeSponsors} active`, icon: Users, color: 'text-primary' },
    { label: 'Total Donations', value: report.totalDonations, sub: 'All time', icon: Gift, color: 'text-success' },
    { label: 'Total Amount', value: formatCurrency(report.totalAmount), sub: 'All time', icon: BarChart3, color: 'text-warning' },
    { label: 'People Helped', value: report.totalPeople.toLocaleString(), sub: 'All time', icon: HandHeart, color: 'text-primary' },
    { label: 'This Month', value: formatCurrency(report.monthlyAmount), sub: 'Donations', icon: Gift, color: 'text-success' },
    { label: 'This Year', value: formatCurrency(report.yearlyAmount), sub: 'Donations', icon: BarChart3, color: 'text-warning' },
    { label: 'Confirmed', value: report.confirmedRequests, sub: 'Sponsorship requests', icon: HandHeart, color: 'text-primary' },
    { label: 'Completed', value: report.completedRequests, sub: 'Sponsorship requests', icon: HandHeart, color: 'text-success' },
  ] : [];

  const exports = [
    { label: 'Sponsor Report', desc: 'All sponsor profiles and contact details', fn: exportSponsors },
    { label: 'Donation Report', desc: 'All donations with type, amount and item details', fn: exportDonations },
    { label: 'Sponsorship Report', desc: 'All sponsorship requests and statuses', fn: exportSponsorships },
    { label: 'Occasion Report', desc: 'All special occasions and dates', fn: exportOccasions },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Analytics</p>
          <h1 className="text-2xl font-semibold mt-1">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Understand your impact and export data.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse"><div className="h-8 bg-muted rounded" /></Card>
            ))}
          </div>
        ) : (
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
                    <div className={`p-2 rounded-lg bg-muted ${m.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-3">Export Data</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {exports.map((e) => (
              <Card key={e.label} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{e.label}</div>
                  <div className="text-sm text-muted-foreground">{e.desc}</div>
                </div>
                <Button variant="outline" size="sm" onClick={e.fn}>
                  <Download className="h-4 w-4 mr-1.5" />CSV
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
