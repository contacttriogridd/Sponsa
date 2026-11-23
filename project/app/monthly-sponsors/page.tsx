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
import { EventWishesCard, type EventSponsorRow } from '@/components/monthly/EventWishesCard';
import { OBSERVANCE_CHIP } from '@/components/monthly/ObservanceChip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OBSERVANCE_KEYS, OBSERVANCE_META, shortDay, type ObservanceKey, type ObservanceView } from '@/lib/observances';
import { loadObservances } from '@/lib/observances-store';
import { nextSponsorEvent, sponsorEventsOf } from '@/lib/event-wishes';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RecordDonationDialog, type DonationPreset } from '@/components/shared/RecordDonationDialog';
import { MonthlyRequestDialog } from '@/components/monthly/MonthlyRequestDialog';
import { Send as SendIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { donationMonth, sumDonations } from '@/lib/donations';
import type { Donation } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateShort } from '@/lib/constants';
import { RAASIS, STARS, astroLabel, isValidCombination } from '@/lib/natchathiram';
import {
  MONTHLY_STATUS_LABELS, effectiveRaasi, formatStarDate, monthKey, shiftMonth, todayIst, upcomingStarDays, whenLabel, type UpcomingStarDay,
} from '@/lib/monthly-sponsors';
import { addDays } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { openMonthlySponsorDrawer, useDrawerDataChanged } from '@/lib/drawer-store';
import type { MonthlyFamilyMember, MonthlyPayment, MonthlySponsor } from '@/lib/types';
import { relationshipLabel } from '@/lib/festival';
import { PhoneLink } from '@/components/shared/PhoneLink';
import { buildCallLink, displayPhone } from '@/lib/phone';
import { AMOUNT_NOT_SET, AMOUNT_NOT_SET_EN, amountLabel } from '@/lib/amount';

type Row = EventSponsorRow;

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
  const [family, setFamily] = useState<Map<string, MonthlyFamilyMember[]>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<'all' | ObservanceKey>('all');
  const [events, setEvents] = useState<ObservanceView[]>([]);
  const [monthDonations, setMonthDonations] = useState<Donation[]>([]);
  const [recordFor, setRecordFor] = useState<DonationPreset | null>(null);
  const [deletingSponsor, setDeletingSponsor] = useState<Row | null>(null);
  const [requesting, setRequesting] = useState<Row[] | null>(null);
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';

  const loadSponsors = useCallback(async () => {
    const { data, error } = await supabase.from('monthly_sponsors').select('*, sponsors(full_name, whatsapp, phone)').order('name');
    if (error) { setNotReady(true); setLoading(false); return; }
    // Deleted sponsors with donation history are kept (deleted_at), but not listed.
    const rows = ((data || []) as Row[]).filter((r) => !r.deleted_at);
    setSponsors(rows);
    const { data: members } = await supabase.from('monthly_family_members').select('*').order('created_at');
    const byParent = new Map<string, MonthlyFamilyMember[]>();
    for (const m of (members || []) as MonthlyFamilyMember[]) byParent.set(m.monthly_sponsor_id, [...(byParent.get(m.monthly_sponsor_id) || []), m]);
    setFamily(byParent);
    setLoading(false);
    // Next star day for each sponsor, from the cached star calendar (60 days covers two cycles).
    const calendar = await loadStarCalendar(addDays(today, -1), addDays(today, 60));
    const next = new Map<string, UpcomingStarDay>();
    for (const u of upcomingStarDays(rows, calendar, today, 60)) if (!next.has(u.sponsor.id)) next.set(u.sponsor.id, u);
    setNextStarDays(next);
  }, [today]);

  const loadPayments = useCallback(async () => {
    const [{ data }, { data: dons }] = await Promise.all([
      supabase.from('monthly_payments').select('*').eq('month', month),
      // Money is counted from donations (Mark paid writes one too, migration 00027), by the month it is for.
      supabase.from('donations').select('*').not('monthly_sponsor_id', 'is', null)
        .gte('donation_date', shiftMonth(month, -2)).lt('donation_date', shiftMonth(month, 3)),
    ]);
    setPayments((data || []) as MonthlyPayment[]);
    setMonthDonations(((dons || []) as Donation[]).filter((d) => donationMonth(d) === month));
  }, [month]);

  useEffect(() => { loadSponsors(); }, [loadSponsors]);
  // Calendar events (same source as the Star Calendar) for event wishes and each sponsor's next event.
  useEffect(() => { loadObservances(today, addDays(today, 60)).then(setEvents); }, [today]);
  const starOn = useCallback((date: string) => new Set(Array.from(nextStarDays.values()).filter((u) => u.occurrence.date === date).map((u) => u.sponsor.id)), [nextStarDays]);
  const starToday = useMemo(() => starOn(today), [starOn, today]);
  const starTomorrow = useMemo(() => starOn(addDays(today, 1)), [starOn, today]);
  useEffect(() => { loadPayments(); }, [loadPayments]);
  const reloadAll = useCallback(() => { loadSponsors(); loadPayments(); }, [loadSponsors, loadPayments]);
  useDrawerDataChanged(reloadAll);

  const paymentBySponsor = useMemo(() => new Map(payments.map((p) => [p.monthly_sponsor_id, p])), [payments]);
  const donatedBySponsor = useMemo(() => {
    const map = new Map<string, Donation[]>();
    for (const d of monthDonations) map.set(d.monthly_sponsor_id!, [...(map.get(d.monthly_sponsor_id!) || []), d]);
    return map;
  }, [monthDonations]);
  /** Paid this month: marked paid, or a donation recorded for this month. */
  const isPaid = useCallback((id: string) => paymentBySponsor.get(id)?.status === 'paid' || (donatedBySponsor.get(id)?.length || 0) > 0, [paymentBySponsor, donatedBySponsor]);

  const summary = useMemo(() => {
    const active = sponsors.filter((s) => s.status === 'active');
    const expected = active.reduce((a, s) => a + Number(s.monthly_amount || 0), 0);
    const collected = sumDonations(monthDonations);
    const pending = active
      .filter((s) => !isPaid(s.id))
      .reduce((a, s) => a + Number(paymentBySponsor.get(s.id)?.amount ?? s.monthly_amount ?? 0), 0);
    return { activeCount: active.length, expected, collected, pending };
  }, [sponsors, monthDonations, paymentBySponsor, isPaid]);

  async function setStatus(s: Row, status: Row['status']) {
    const { error } = await supabase.from('monthly_sponsors').update({ status }).eq('id', s.id);
    if (error) { toast.error('Unable to change the status.'); return; }
    toast.success(`${s.name} is now ${MONTHLY_STATUS_LABELS[status]}.`);
    loadSponsors();
  }

  async function deleteSponsor(s: Row) {
    const { data, error } = await supabase.rpc('delete_monthly_sponsor', { p_id: s.id });
    if (error) {
      toast.error(error.code === 'PGRST202' ? 'Deleting needs database migration 00027.' : /admin/i.test(error.message) ? 'Only an admin can delete monthly sponsors.' : 'Unable to delete. Please try again.');
      return;
    }
    toast.success(data === 'archived'
      ? `${s.name} was removed from the list. Their donations stay in Donations and every total.`
      : `${s.name} was deleted.`);
    loadSponsors(); loadPayments();
  }

  const filtered = sponsors.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (eventFilter !== 'all' && !sponsorEventsOf(s).some((e) => e.event_key === eventFilter)) return false;
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
            <Button variant="outline" disabled={notReady} title="Send the Monthly Sponsorship Request to everyone who has not paid this month"
              onClick={() => setRequesting(sponsors.filter((s) => s.status === 'active' && !isPaid(s.id) && (!s.start_date || s.start_date.slice(0, 7) <= month.slice(0, 7))))}>
              <SendIcon className="h-4 w-4 mr-2" />Payment requests
            </Button>
            <Button variant="outline" onClick={() => setRecordFor({ sponsorType: 'monthly', category: 'Monthly', occasionDate: month })} disabled={notReady}>
              <IndianRupee className="h-4 w-4 mr-2" />Record Donation
            </Button>
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

            <EventWishesCard
              sponsors={sponsors}
              events={events}
              today={today}
              starToday={starToday}
              starTomorrow={starTomorrow}
              paymentBySponsor={paymentBySponsor}
              onMarkPaid={(s) => setPaying(s)}
            />

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
                <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as 'all' | ObservanceKey)}>
                  <SelectTrigger className="h-9 md:w-52" aria-label="Event filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Event: All</SelectItem>
                    {OBSERVANCE_KEYS.map((k) => <SelectItem key={k} value={k}>{OBSERVANCE_META[k].icon} {OBSERVANCE_META[k].ta} · {OBSERVANCE_META[k].short}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                  const sponsorEvents = sponsorEventsOf(s);
                  const nextEvent = nextSponsorEvent(s, events, today);
                  return (
                    <Card key={s.id} className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button type="button" aria-label={`Open ${s.name}`} onClick={() => openMonthlySponsorDrawer(s.id)} className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Star className="h-5 w-5" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button type="button" onClick={() => openMonthlySponsorDrawer(s.id)} className="font-semibold hover:text-primary text-left">{s.name}</button>
                              {s.status !== 'active' && <Badge variant="outline">{MONTHLY_STATUS_LABELS[s.status]}</Badge>}
                              {(family.get(s.id)?.length || 0) > 0 && (
                                <button type="button" onClick={() => setExpanded(expanded === s.id ? null : s.id)} aria-expanded={expanded === s.id}>
                                  <Badge variant="secondary" className="font-normal">👨‍👩‍👧 {family.get(s.id)!.length}</Badge>
                                </button>
                              )}
                              {sponsorEvents.map((e) => (
                                <span key={e.event_key} title={`${OBSERVANCE_META[e.event_key].ta} · ${OBSERVANCE_META[e.event_key].short}`} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]', OBSERVANCE_CHIP[e.event_key])}>
                                  {OBSERVANCE_META[e.event_key].icon} {OBSERVANCE_META[e.event_key].short}
                                </span>
                              ))}
                              {!isValidCombination(s.raasi, s.star) && (
                                <Badge variant="outline" className="text-warning border-warning/40"><AlertTriangle className="h-3 w-3 mr-1" />Check Raasi/Star</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {s.star != null ? astroLabel(STARS[s.star]) : sponsorEvents.length ? 'Monthly events only' : 'Star not set'}
                              {raasi != null && ` · ${astroLabel(RAASIS[raasi])}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                              {s.phone && <PhoneLink href={buildCallLink(s.phone)} onEdit={() => { setEditing(s); setShowForm(true); }} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{displayPhone(s.phone)}</PhoneLink>}
                              {s.sponsors?.full_name && <span>{s.relationship ? `${s.relationship} of ` : 'Related to '}{s.sponsors.full_name}</span>}
                              {s.payment_day && <span>Pays on day {s.payment_day}</span>}
                            </div>
                            {expanded === s.id && (
                              <ul className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                                {family.get(s.id)!.map((m) => (
                                  <li key={m.id}>{m.name} · {relationshipLabel(m)}{m.star != null ? ` · ${STARS[m.star].ta} (${STARS[m.star].en})` : ''}</li>
                                ))}
                              </ul>
                            )}
                            {(next || nextEvent) && (
                              <div className="text-sm mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                                {next && (
                                  <span>
                                    ⭐ Next star day: <span className="font-medium">{formatStarDate(next.occurrence.date)}</span>{' '}
                                    <span className="text-muted-foreground">({whenLabel(next.daysUntil)})</span>
                                  </span>
                                )}
                                {nextEvent && (
                                  <span>
                                    {nextEvent.label.icon} Next event: <span className="font-medium">{OBSERVANCE_META[nextEvent.event_key].short} · {shortDay(nextEvent.on).replace(/^\w+ /, '')}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                          <div className="text-right mr-1">
                            <div className={s.monthly_amount != null ? 'font-semibold text-sm' : 'text-xs text-muted-foreground'}>{amountLabel(s.monthly_amount)}</div>
                            {payment?.status === 'paid' ? (
                              <div className="text-xs text-success">Paid{payment.paid_on ? ` ${formatDateShort(payment.paid_on)}` : ''}{payment.mode ? ` · ${payment.mode}` : ''}</div>
                            ) : donatedBySponsor.get(s.id)?.length ? (
                              <div className="text-xs text-success">Received {formatCurrency(sumDonations(donatedBySponsor.get(s.id)!))}</div>
                            ) : (
                              <div className="text-xs text-muted-foreground">Pending</div>
                            )}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setPaying(s)}>
                            {payment?.status === 'paid' ? 'Edit payment' : 'Mark paid'}
                          </Button>
                          {next && <SendWishButton sponsor={s} starDate={next.occurrence.date} />}
                          <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEditing(s); setShowForm(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`More actions for ${s.name}`}><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setRecordFor({ sponsorType: 'monthly', sponsorId: s.id, sponsorName: s.name, category: 'Monthly', occasionDate: month })}>Record Donation</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRequesting([s])}>Send payment request</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditing(s); setShowForm(true); }}>Edit</DropdownMenuItem>
                              {s.status === 'active'
                                ? <DropdownMenuItem onClick={() => setStatus(s, 'stopped')}>Mark Inactive</DropdownMenuItem>
                                : <DropdownMenuItem onClick={() => setStatus(s, 'active')}>Mark Active</DropdownMenuItem>}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingSponsor(s)}>Delete…</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

        <MonthlyRequestDialog open={!!requesting} onOpenChange={(o) => !o && setRequesting(null)} sponsors={requesting || []} month={month} />

        <RecordDonationDialog open={!!recordFor} onOpenChange={(o) => !o && setRecordFor(null)} preset={recordFor} onSaved={() => loadPayments()} />

        <ConfirmDialog
          open={!!deletingSponsor}
          onOpenChange={(o) => !o && setDeletingSponsor(null)}
          title={`Delete ${deletingSponsor?.name || 'monthly sponsor'}?`}
          description="If this sponsor has donations, they are kept in Donations and every total, and the sponsor is only removed from this list. Otherwise the sponsor, their family members and payment months are deleted. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => { if (deletingSponsor) deleteSponsor(deletingSponsor); setDeletingSponsor(null); }}
        />
      </div>
    </AppLayout>
  );
}
