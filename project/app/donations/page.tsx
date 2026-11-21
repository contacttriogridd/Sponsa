'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Edit, Gift, Plus, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DonationForm } from '@/components/shared/DonationForm';
import { DeleteRecordDialog, type DeletableRecord } from '@/components/shared/DeleteRecordDialog';
import { RecordDonationDialog } from '@/components/shared/RecordDonationDialog';
import { ThankYouDialog } from '@/components/shared/ThankYouDialog';
import { ThanksStatusButton } from '@/components/shared/ThanksStatusButton';
import { openMonthlySponsorDrawer, useDrawerDataChanged } from '@/lib/drawer-store';
import { thanksStatus } from '@/lib/messaging';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate, normalizeDonationType } from '@/lib/constants';
import { CATEGORY_META, categoryOf, sumDonations, totalsByCategory, type DonationCategory } from '@/lib/donations';
import { todayIst } from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import type { Donation, MessageLog, Sponsor } from '@/lib/types';

type Row = Donation & {
  sponsors?: { id: string; full_name: string; preferred_name: string | null; phone: string | null; whatsapp: string | null; email: string | null } | null;
  monthly_sponsors?: { id: string; name: string; phone: string | null } | null;
};

const donorName = (d: Row) => d.sponsors?.full_name || d.monthly_sponsors?.name || d.sponsor_name || 'Unknown';

export default function DonationsPage() {
  const { appUser } = useAuth();
  const [deleting, setDeleting] = useState<DeletableRecord | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [period, setPeriod] = useState('all');
  const [category, setCategory] = useState<'all' | DonationCategory>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [thanksFilter, setThanksFilter] = useState<'all' | 'sent' | 'pending'>('all');
  const [thanking, setThanking] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const sponsorCols = 'id, full_name, preferred_name, phone, whatsapp, email';
    const [d, l] = await Promise.all([
      supabase.from('donations').select(`*, sponsors(${sponsorCols}), monthly_sponsors(id, name, phone)`).order('donation_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('message_logs').select('*').eq('message_type', 'donation_thanks'),
    ]);
    // Before migration 00018 there is no monthly sponsor link to join.
    const donations = d.error
      ? (await supabase.from('donations').select(`*, sponsors(${sponsorCols})`).order('donation_date', { ascending: false })).data
      : d.data;
    setItems((donations || []) as Row[]);
    setLogs((l.error ? [] : l.data || []) as MessageLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useDrawerDataChanged(load);

  // Dates are compared as IST calendar dates (YYYY-MM-DD).
  const today = todayIst();
  const inPeriod = useCallback((date: string) => (
    period === 'all'
    || (period === 'today' && date === today)
    || (period === 'week' && date > addDays(today, -7) && date <= today)
    || (period === 'month' && date.slice(0, 7) === today.slice(0, 7))
    || (period === 'year' && date.slice(0, 4) === today.slice(0, 4))
  ), [period, today]);

  // Everything except the category filter: the chips show each category's share of this.
  const base = useMemo(() => items.filter((d) => {
    const q = query.toLowerCase();
    const matchQuery = !q || donorName(d).toLowerCase().includes(q) || d.occasion_name?.toLowerCase().includes(q) || d.receipt_number?.toLowerCase().includes(q);
    const thanked = thanksStatus(d, logs).sent;
    const matchThanks = thanksFilter === 'all' || (thanksFilter === 'sent' ? thanked : !thanked);
    return inPeriod(d.donation_date) && matchQuery && matchThanks;
  }), [items, query, logs, thanksFilter, inPeriod]);

  const byCategory = useMemo(() => totalsByCategory(base), [base]);
  const filtered = category === 'all' ? base : base.filter((d) => categoryOf(d) === category);
  const total = sumDonations(filtered);
  const people = filtered.reduce((a, d) => a + Number(d.people_helped || 0), 0);

  /** Who to thank for a donation: the sponsor, or the monthly sponsor (not logged against a sponsor record). */
  const thanksTarget = (d: Row) => (d.monthly_sponsors
    ? { sponsor: { id: d.monthly_sponsors.id, full_name: d.monthly_sponsors.name, preferred_name: null, phone: d.monthly_sponsors.phone, whatsapp: null, email: null } as Sponsor, logSponsorId: null }
    : { sponsor: d.sponsors as unknown as Sponsor, logSponsorId: undefined });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Impact</p>
            <h1 className="text-2xl font-semibold mt-1">Donations</h1>
            <p className="text-sm text-muted-foreground mt-1">Every rupee received, in one list. All totals in the app are calculated from here.</p>
          </div>
          <Button onClick={() => setRecording(true)}>
            <Plus className="h-4 w-4 mr-2" />Record Donation
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <div className="text-xl font-bold">{formatCurrency(total)}</div>
            <div className="text-xs text-muted-foreground mt-1">{category === 'all' ? 'Total Amount' : `${category} total`} · {filtered.length} donation{filtered.length === 1 ? '' : 's'}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold">{people.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">People Helped</div>
          </Card>
        </div>

        <Card className="p-3 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by sponsor, occasion or receipt no..." className="flex-1" />
            <div className="flex flex-wrap gap-1">
              {[['all', 'All'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year']].map(([key, label]) => (
                <Button key={key} variant={period === key ? 'secondary' : 'ghost'} size="sm" onClick={() => setPeriod(key)}>{label}</Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 md:border-l md:pl-3 border-border">
              {([['all', 'All'], ['sent', 'Thanks Sent'], ['pending', 'Thanks Pending']] as const).map(([key, label]) => (
                <Button key={key} variant={thanksFilter === key ? 'secondary' : 'ghost'} size="sm" onClick={() => setThanksFilter(key)}>{label}</Button>
              ))}
            </div>
          </div>
          {/* Category filter: each chip shows that category's sum for the period above. */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            <Button size="sm" variant={category === 'all' ? 'secondary' : 'outline'} className="h-auto py-1" onClick={() => setCategory('all')}>
              All categories <span className="ml-1.5 text-muted-foreground">{formatCurrency(byCategory.total)}</span>
            </Button>
            {byCategory.rows.filter((r) => r.count > 0 || category === r.category).map((r) => (
              <Button key={r.category} size="sm" variant={category === r.category ? 'secondary' : 'outline'} className="h-auto py-1" onClick={() => setCategory(r.category)}>
                {CATEGORY_META[r.category].icon} {r.category} <span className="ml-1.5 text-muted-foreground">{formatCurrency(r.amount)} · {r.count}</span>
              </Button>
            ))}
          </div>
        </Card>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                      <Gift className="h-5 w-5 text-success" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {d.monthly_sponsors ? (
                          <button type="button" onClick={() => openMonthlySponsorDrawer(d.monthly_sponsors!.id)} className="font-semibold hover:text-primary text-left">{d.monthly_sponsors.name}</button>
                        ) : d.sponsor_id && d.sponsors ? (
                          <Link href={`/sponsors/${d.sponsor_id}`} className="font-semibold hover:text-primary">{d.sponsors.full_name}</Link>
                        ) : (
                          <span className="font-semibold">{donorName(d)}</span>
                        )}
                        <Badge variant="secondary" className="text-xs font-normal">{CATEGORY_META[categoryOf(d)].icon} {categoryOf(d)}</Badge>
                        {d.sponsor_type === 'walkin' && <Badge variant="outline" className="text-xs">Walk-in</Badge>}
                        <Badge variant="outline" className="text-xs">{normalizeDonationType(d.type)}</Badge>
                        {d.food_type && <Badge variant="outline" className="text-xs">{d.food_type}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(d.donation_date)}
                        {d.occasion_date && d.occasion_date !== d.donation_date ? ` · for ${formatDate(d.occasion_date)}` : ''}
                        {d.occasion_name ? ` · ${d.occasion_name}` : ''}
                        {d.payment_method ? ` · ${d.payment_method}` : ''}
                        {d.people_helped ? ` · ${d.people_helped} people` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {(d.sponsors || d.monthly_sponsors) && <ThanksStatusButton donation={d} logs={logs} onSend={() => setThanking(d)} />}
                    <div className="text-right">
                      <div className="font-bold text-success">{formatCurrency(Number(d.amount))}</div>
                      {(d.receipt_number || d.donation_id) && <div className="text-xs text-muted-foreground">{d.receipt_number || d.donation_id}</div>}
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Edit donation" onClick={() => setEditing(d)}><Edit className="h-4 w-4" /></Button>
                    {appUser?.role === 'admin' && (
                      <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete donation"
                        onClick={() => setDeleting({
                          kind: 'donation', id: d.id, sponsor_id: d.sponsor_id, amount: d.amount, people_helped: d.people_helped,
                          label: `${donorName(d)} — ${formatCurrency(Number(d.amount))} on ${formatDate(d.donation_date)}`,
                        })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="py-14 text-center">
                <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">{items.length ? 'No donations match these filters' : 'No donations recorded yet'}</h3>
                <p className="text-sm text-muted-foreground mt-1">{items.length ? 'Try another period or category.' : 'Record your first donation to get started.'}</p>
              </Card>
            )}
          </div>
        )}
      </div>

      <RecordDonationDialog open={recording} onOpenChange={setRecording} onSaved={() => load()} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Donation</DialogTitle></DialogHeader>
          {editing && (
            <DonationForm
              key={editing.id}
              donation={editing}
              sponsorId={editing.sponsor_id || editing.monthly_sponsor_id || ''}
              sponsorType={(editing.sponsor_type as 'regular' | 'monthly' | 'walkin') || 'regular'}
              sponsorName={donorName(editing)}
              onSaved={() => { setEditing(null); load(); }}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {(thanking?.sponsors || thanking?.monthly_sponsors) && (
        <ThankYouDialog
          sponsor={thanksTarget(thanking).sponsor}
          logSponsorId={thanksTarget(thanking).logSponsorId}
          donation={thanking}
          onOpenChange={(o) => { if (!o) setThanking(null); }}
          onSent={() => load()}
        />
      )}
      <DeleteRecordDialog
        record={deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onDeleted={() => load()}
      />
    </AppLayout>
  );
}
