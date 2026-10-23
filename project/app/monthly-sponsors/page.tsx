'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Edit, IndianRupee, Phone, Plus, Search, Star, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/shared/StatCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MonthlySponsorForm } from '@/components/monthly/MonthlySponsorForm';
import { PaymentDialog } from '@/components/monthly/PaymentDialog';
import { SendWishButton } from '@/components/monthly/SendWishButton';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateShort } from '@/lib/constants';
import { RAASIS, STARS, astroLabel, isValidCombination } from '@/lib/natchathiram';
import {
  MONTHLY_STATUS_LABELS, effectiveRaasi, formatStarDate, monthKey, shiftMonth, todayIst, upcomingStarDays, whenLabel, type UpcomingStarDay,
} from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { useStarWish } from '@/lib/star-wish';
import type { MonthlyPayment, MonthlySponsor } from '@/lib/types';

type Row = MonthlySponsor & { sponsors?: { full_name: string } | null };

export default function MonthlySponsorsPage() {
  const today = todayIst();
  const [sponsors, setSponsors] = useState<Row[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [nextStarDays, setNextStarDays] = useState<Map<string, UpcomingStarDay>>(new Map());
  const [month, setMonth] = useState(monthKey(today));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'active' | 'paused' | 'stopped' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState<Row | null>(null);
  const buildWish = useStarWish();

  const loadSponsors = useCallback(async () => {
    const { data, error } = await supabase.from('monthly_sponsors').select('*, sponsors(full_name)').order('name');
    if (error) { setNotReady(true); setLoading(false); return; }
    const rows = (data || []) as Row[];
    setSponsors(rows);
    setLoading(false);
    // Next star day for each sponsor, from the cached star calendar (60 days covers two cycles).
    const calendar = await loadStarCalendar(addDays(today, -1), addDays(today, 60));
    const next = new Map<string, UpcomingStarDay>();
    for (const u of upcomingStarDays(rows, calendar, today, 60)) if (!next.has(u.sponsor.id)) next.set(u.sponsor.id, u);
    setNextStarDays(next);
  }, [today]);

  const loadPayments = useCallback(async () => {
    const { data } = await supabase.from('monthly_payments').select('*').eq('month', month);
    setPayments((data || []) as MonthlyPayment[]);
  }, [month]);

  useEffect(() => { loadSponsors(); }, [loadSponsors]);
  useEffect(() => { loadPayments(); }, [loadPayments]);

  const paymentBySponsor = useMemo(() => new Map(payments.map((p) => [p.monthly_sponsor_id, p])), [payments]);

  const summary = useMemo(() => {
    const active = sponsors.filter((s) => s.status === 'active');
    const expected = active.reduce((a, s) => a + Number(s.monthly_amount || 0), 0);
    const collected = payments.filter((p) => p.status === 'paid').reduce((a, p) => a + Number(p.amount || 0), 0);
    const pending = active
      .filter((s) => paymentBySponsor.get(s.id)?.status !== 'paid')
      .reduce((a, s) => a + Number(paymentBySponsor.get(s.id)?.amount ?? s.monthly_amount ?? 0), 0);
    return { activeCount: active.length, expected, collected, pending };
  }, [sponsors, payments, paymentBySponsor]);

  const filtered = sponsors.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    const star = s.star != null ? `${STARS[s.star].ta} ${STARS[s.star].en}` : '';
    return [s.name, s.phone, star].some((v) => v?.toLowerCase().includes(q));
  });

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Monthly giving</p>
            <h1 className="text-2xl font-semibold mt-1">Monthly Sponsors</h1>
            <p className="text-sm text-muted-foreground mt-1">மாதாந்திர நன்கொடையாளர்கள் — star days and monthly contributions.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/monthly-sponsors/star-calendar">
              <Button variant="outline"><CalendarDays className="h-4 w-4 mr-2" />Star Calendar</Button>
            </Link>
            <Button onClick={() => { setEditing(null); setShowForm(true); }} disabled={notReady}>
              <Plus className="h-4 w-4 mr-2" />Add Monthly Sponsor
            </Button>
          </div>
        </div>

        {notReady ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Monthly Sponsors needs database migration 00011 (monthly_sponsors_star_days). Run it in the Supabase SQL Editor, then reload this page.
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{monthLabel}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(today))}>This month</Button>
                <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
              <StatCard label="Active Monthly Sponsors" value={summary.activeCount} icon={Users} iconColor="text-primary" />
              <StatCard label="Monthly Collection" value={formatCurrency(summary.expected)} icon={IndianRupee} iconColor="text-warning" trend="Expected from active sponsors" />
              <StatCard label="Collected" value={formatCurrency(summary.collected)} icon={CheckCircle2} iconColor="text-success" trend={monthLabel} />
              <StatCard label="Pending" value={formatCurrency(summary.pending)} icon={Clock} iconColor="text-destructive" trend={monthLabel} />
            </div>

            <Card className="p-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone or star (Tamil or English)" className="pl-9" />
                </div>
                <div className="flex gap-1">
                  {(['active', 'paused', 'stopped', 'all'] as const).map((f) => (
                    <Button key={f} variant={filter === f ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
                  ))}
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Loading monthly sponsors...</div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((s) => {
                  const payment = paymentBySponsor.get(s.id);
                  const next = nextStarDays.get(s.id);
                  const raasi = effectiveRaasi(s);
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Star className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">{s.name}</span>
                              {s.status !== 'active' && <Badge variant="outline">{MONTHLY_STATUS_LABELS[s.status]}</Badge>}
                              {!isValidCombination(s.raasi, s.star) && (
                                <Badge variant="outline" className="text-warning border-warning/40"><AlertTriangle className="h-3 w-3 mr-1" />Check Raasi/Star</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {s.star != null ? astroLabel(STARS[s.star]) : 'Star not set'}
                              {raasi != null && ` · ${astroLabel(RAASIS[raasi])}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                              {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{s.phone}</a>}
                              {s.sponsors?.full_name && <span>{s.relationship ? `${s.relationship} of ` : 'Related to '}{s.sponsors.full_name}</span>}
                              {s.payment_day && <span>Pays on day {s.payment_day}</span>}
                            </div>
                            {next && (
                              <div className="text-sm mt-1.5">
                                ⭐ Next star day: <span className="font-medium">{formatStarDate(next.occurrence.date)}</span>{' '}
                                <span className="text-muted-foreground">({whenLabel(next.daysUntil)})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                          <div className="text-right mr-1">
                            <div className="font-semibold text-sm">{s.monthly_amount != null ? formatCurrency(Number(s.monthly_amount)) : '—'}</div>
                            {payment?.status === 'paid' ? (
                              <div className="text-xs text-success">Paid{payment.paid_on ? ` ${formatDateShort(payment.paid_on)}` : ''}{payment.mode ? ` · ${payment.mode}` : ''}</div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Pending</div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setPaying(s)}>
                            {payment?.status === 'paid' ? 'Edit payment' : 'Mark paid'}
                          </Button>
                          {next && <SendWishButton href={buildWish(s, next.occurrence.date).url} />}
                          <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setShowForm(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {filtered.length === 0 && (
                  <Card className="py-14 text-center">
                    <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold">No monthly sponsors found</h3>
                    <p className="text-sm text-muted-foreground mt-1">Try a different search or add a monthly sponsor.</p>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

        <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Monthly Sponsor' : 'Add Monthly Sponsor'}</DialogTitle>
            </DialogHeader>
            <MonthlySponsorForm
              sponsor={editing}
              onCancel={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); loadSponsors(); }}
            />
          </DialogContent>
        </Dialog>

        <PaymentDialog
          sponsor={paying}
          month={month}
          payment={paying ? paymentBySponsor.get(paying.id) : undefined}
          onOpenChange={(o) => !o && setPaying(null)}
          onSaved={() => loadPayments()}
        />
      </div>
    </AppLayout>
  );
}
