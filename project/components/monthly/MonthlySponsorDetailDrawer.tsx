'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Copy, Edit, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import { SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MonthlySponsorForm } from '@/components/monthly/MonthlySponsorForm';
import { PaymentDialog } from '@/components/monthly/PaymentDialog';
import { SendWishButton } from '@/components/monthly/SendWishButton';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateShort } from '@/lib/constants';
import { RAASIS, STARS, astroLabel } from '@/lib/natchathiram';
import {
  MONTHLY_STATUS_LABELS, daysBetween, effectiveRaasi, formatIstTime, monthKey, shiftMonth, todayIst, whenLabel,
} from '@/lib/monthly-sponsors';
import { addDays, starDaysFor, type StarDayOccurrence } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { whatsappNumber } from '@/lib/star-wish';
import { notifyDrawerDataChanged, openSponsorDrawer, useDrawerDataChanged } from '@/lib/drawer-store';
import { cn } from '@/lib/utils';
import type { MonthlyPayment, MonthlySponsor, MonthlySponsorStatus, MonthlyWishLog } from '@/lib/types';

type Row = MonthlySponsor & { sponsors?: { full_name: string } | null };

const MAX_HISTORY_MONTHS = 24;
const monthLabel = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function countdownClass(days: number): string {
  if (days === 0) return 'bg-success/15 text-success border-success/30';
  if (days <= 7) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function MonthlySponsorDetailDrawer({ monthlyId }: { monthlyId: string }) {
  const today = todayIst();
  const thisMonth = monthKey(today);
  const [sponsor, setSponsor] = useState<Row | null>(null);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [wishes, setWishes] = useState<MonthlyWishLog[]>([]);
  const [starDays, setStarDays] = useState<StarDayOccurrence[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const [s, p, w] = await Promise.all([
      supabase.from('monthly_sponsors').select('*, sponsors(full_name)').eq('id', monthlyId).maybeSingle(),
      supabase.from('monthly_payments').select('*').eq('monthly_sponsor_id', monthlyId).order('month', { ascending: false }),
      supabase.from('monthly_wish_log').select('*').eq('monthly_sponsor_id', monthlyId).order('sent_at', { ascending: false }).limit(30),
    ]);
    if (!s.data) { setError(s.error ? 'Monthly Sponsors needs database migration 00011.' : 'Monthly sponsor not found.'); return; }
    const row = s.data as Row;
    setSponsor(row);
    setPayments((p.data || []) as MonthlyPayment[]);
    setWishes(w.error ? [] : (w.data || []) as MonthlyWishLog[]); // wish log arrives with migration 00012
    if (row.star != null) {
      // ~200 days covers the next star day plus six more (one every ~27 days).
      const rows = await loadStarCalendar(addDays(today, -1), addDays(today, 200));
      setStarDays(starDaysFor(row.star, rows).filter((o) => o.date >= today).slice(0, 7));
    } else {
      setStarDays([]);
    }
  }, [monthlyId, today]);

  useEffect(() => { setSponsor(null); setStarDays(null); setError(''); load(); }, [load]);
  // Reload after a wish is sent from this drawer's Send Wish dialog.
  useDrawerDataChanged(load);

  async function setStatus(status: MonthlySponsorStatus) {
    if (!sponsor || sponsor.status === status) return;
    setSponsor({ ...sponsor, status });
    await supabase.from('monthly_sponsors').update({ status }).eq('id', sponsor.id);
    notifyDrawerDataChanged();
  }

  const ledger = useMemo(() => {
    if (!sponsor) return { rows: [], total: 0, paid: 0, pending: 0 };
    const start = monthKey(sponsor.start_date || sponsor.created_at.slice(0, 10));
    const earliest = shiftMonth(thisMonth, -(MAX_HISTORY_MONTHS - 1));
    const from = start > earliest ? start : earliest;
    const byMonth = new Map(payments.map((p) => [p.month, p]));
    const months = new Set<string>(payments.map((p) => p.month));
    for (let m = from; m <= thisMonth; m = shiftMonth(m, 1)) months.add(m);
    const rows = Array.from(months).sort((a, b) => b.localeCompare(a)).map((month) => {
      const p = byMonth.get(month);
      return { month, payment: p, paid: p?.status === 'paid', amount: p?.amount ?? sponsor.monthly_amount };
    });
    const paidRows = rows.filter((r) => r.paid);
    return {
      rows,
      total: paidRows.reduce((a, r) => a + Number(r.amount || 0), 0),
      paid: paidRows.length,
      pending: rows.filter((r) => !r.paid && r.month <= thisMonth).length,
    };
  }, [sponsor, payments, thisMonth]);

  if (error) return <SheetContent side="right" className="w-full sm:max-w-[480px]"><SheetTitle className="sr-only">Monthly sponsor</SheetTitle><p className="text-sm text-muted-foreground mt-6">{error}</p></SheetContent>;

  const raasi = sponsor ? effectiveRaasi(sponsor) : null;
  const next = starDays?.[0];
  const currentPaid = ledger.rows.find((r) => r.month === thisMonth)?.paid;

  return (
    <>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 overflow-y-auto">
        <SheetTitle className="sr-only">{sponsor?.name || 'Monthly sponsor'}</SheetTitle>
        {!sponsor ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-3"><div className="h-14 w-14 rounded-full bg-muted" /><div className="space-y-2 flex-1"><div className="h-4 w-1/2 bg-muted rounded" /><div className="h-3 w-1/3 bg-muted rounded" /></div></div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
          </div>
        ) : (
          <div className="pb-8">
            <div className="p-5 pr-12 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><Star className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{sponsor.name}</h2>
                  {sponsor.phone && <a href={`tel:${sponsor.phone}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{sponsor.phone}</a>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {sponsor.phone && <a href={`tel:${sponsor.phone}`}><Button variant="outline" size="sm"><Phone className="h-4 w-4 mr-1.5" />Call</Button></a>}
                {sponsor.phone && (
                  <a href={buildWhatsAppUrl(whatsappNumber(sponsor.phone))} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50"><MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp</Button>
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit className="h-4 w-4 mr-1.5" />Edit</Button>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1.5">Status</div>
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                  {(Object.keys(MONTHLY_STATUS_LABELS) as MonthlySponsorStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatus(st)}
                      className={cn('px-3 py-1 text-sm rounded-md transition-colors', sponsor.status === st ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {MONTHLY_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              <div className="grid grid-cols-2 gap-2">
                {next ? <SendWishButton sponsor={sponsor} starDate={next.date} size="default" /> : <Button disabled variant="outline">Send Wish</Button>}
                <Button variant="outline" onClick={() => setPaying(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />{currentPaid ? 'Edit this month' : 'Mark paid'}
                </Button>
              </div>

              <Section title="Star & Raasi">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs text-muted-foreground">நட்சத்திரம் (Star)</div>
                    <div className="font-medium mt-0.5">{sponsor.star != null ? astroLabel(STARS[sponsor.star]) : '—'}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs text-muted-foreground">ராசி (Raasi)</div>
                    <div className="font-medium mt-0.5">{raasi != null ? astroLabel(RAASIS[raasi]) : '—'}</div>
                  </div>
                </div>
              </Section>

              <Section title="Star days">
                {starDays === null ? <div className="h-24 rounded-xl bg-muted animate-pulse" /> : next ? (
                  <div className="space-y-2">
                    <div className={cn('rounded-xl border p-4', countdownClass(daysBetween(today, next.date)))}>
                      <div className="text-xs font-medium uppercase tracking-wide">Next star day</div>
                      <div className="font-semibold mt-1">{longDate(next.date)}</div>
                      <div className="text-sm mt-0.5">{whenLabel(daysBetween(today, next.date))} · star {formatIstTime(next.start)} → {formatIstTime(next.end)}</div>
                    </div>
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {starDays.slice(1).map((o) => (
                        <div key={o.date} className="p-3 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{longDate(o.date)}</span>
                          <span className="text-xs text-muted-foreground">{whenLabel(daysBetween(today, o.date))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Add a star to see star days.</p>}
              </Section>

              <Section title="Details">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <Detail label="Monthly amount">{sponsor.monthly_amount != null ? formatCurrency(Number(sponsor.monthly_amount)) : '—'}</Detail>
                  <Detail label="Payment day">{sponsor.payment_day ? `Day ${sponsor.payment_day} of each month` : '—'}</Detail>
                  <Detail label="Payment mode">{sponsor.payment_mode || '—'}</Detail>
                  <Detail label="Start date">{sponsor.start_date ? formatDateShort(sponsor.start_date) : '—'}</Detail>
                  <Detail label="Address">{sponsor.address ? <span className="inline-flex gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{sponsor.address}</span> : '—'}</Detail>
                  <Detail label="Date of birth">{sponsor.dob ? formatDateShort(sponsor.dob) : '—'}</Detail>
                  {sponsor.sponsor_id && sponsor.sponsors?.full_name && (
                    <Detail label="Related sponsor">
                      <button className="text-primary hover:underline" onClick={() => openSponsorDrawer(sponsor.sponsor_id!)}>
                        {sponsor.sponsors.full_name}{sponsor.relationship ? ` (${sponsor.relationship})` : ''}
                      </button>
                    </Detail>
                  )}
                  <Detail label="Notes">{sponsor.notes || '—'}</Detail>
                </dl>
              </Section>

              <Section title="Payments">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Total contributed" value={formatCurrency(ledger.total)} />
                  <Stat label="Months paid" value={String(ledger.paid)} />
                  <Stat label="Months pending" value={String(ledger.pending)} />
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr><th className="text-left font-medium p-2.5">Month</th><th className="text-right font-medium p-2.5">Amount</th><th className="text-left font-medium p-2.5">Status</th><th className="text-left font-medium p-2.5">Paid on</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledger.rows.map((r) => (
                        <tr key={r.month}>
                          <td className="p-2.5 whitespace-nowrap">{monthLabel(r.month)}</td>
                          <td className="p-2.5 text-right whitespace-nowrap">{r.amount != null ? formatCurrency(Number(r.amount)) : '—'}</td>
                          <td className="p-2.5">
                            {r.paid ? <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15" variant="outline">Paid</Badge>
                              : r.month === thisMonth ? <button onClick={() => setPaying(true)} className="text-xs text-primary hover:underline">Mark paid</button>
                              : <Badge variant="outline" className="text-muted-foreground">Pending</Badge>}
                          </td>
                          <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.payment?.paid_on ? `${formatDateShort(r.payment.paid_on)}${r.payment.mode ? ` · ${r.payment.mode}` : ''}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Wish history">
                <div className="space-y-2">
                  {wishes.map((w) => (
                    <div key={w.id} className="flex items-start gap-3 text-sm">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {w.channel === 'whatsapp' ? <MessageCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div>{w.channel === 'whatsapp' ? 'Sent via WhatsApp' : 'Message copied'}{w.template_type ? ` · ${w.template_type}` : ''}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(w.sent_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                          {w.star_date ? ` · for star day ${formatDateShort(w.star_date)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {wishes.length === 0 && <p className="text-sm text-muted-foreground">No wishes sent yet.</p>}
                </div>
              </Section>
            </div>
          </div>
        )}
      </SheetContent>

      {sponsor && (
        <>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Monthly Sponsor</DialogTitle></DialogHeader>
              <MonthlySponsorForm sponsor={sponsor} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); notifyDrawerDataChanged(); load(); }} />
            </DialogContent>
          </Dialog>
          <PaymentDialog
            sponsor={paying ? sponsor : null}
            month={thisMonth}
            payment={payments.find((p) => p.month === thisMonth)}
            onOpenChange={(o) => !o && setPaying(false)}
            onSaved={() => { notifyDrawerDataChanged(); load(); }}
          />
        </>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2.5">
      <div className="font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
