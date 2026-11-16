'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, MessageCircle, Phone, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OBSERVANCE_CHIP } from '@/components/monthly/ObservanceChip';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { addDays } from '@/lib/star-days';
import { whatsappNumber } from '@/lib/phone';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { logMessage } from '@/lib/message-service';
import { openMonthlySponsorDrawer } from '@/lib/drawer-store';
import { formatStarDate, whenLabel, daysBetween } from '@/lib/monthly-sponsors';
import { shortDay, type ObservanceView } from '@/lib/observances';
import { buildEventWishMessage, eventDays, eventWishesOn, type EventWish } from '@/lib/event-wishes';
import { loadEventWishContext, loadEventWishSent, logEventWish, sentKey, type EventWishContext } from '@/lib/event-wishes-store';
import { cn } from '@/lib/utils';
import type { MonthlyPayment, MonthlySponsor } from '@/lib/types';

export type EventSponsorRow = MonthlySponsor & { sponsors?: { full_name: string; whatsapp?: string | null; phone?: string | null } | null };

interface Props {
  sponsors: EventSponsorRow[];
  /** Calendar events from today on (a few weeks ahead), date-sorted. */
  events: ObservanceView[];
  today: string;
  /** Sponsors whose star day is today / tomorrow: shown once, with a ⭐ tag. */
  starToday: Set<string>;
  starTomorrow: Set<string>;
  paymentBySponsor: Map<string, MonthlyPayment>;
  onMarkPaid: (sponsor: EventSponsorRow) => void;
}

/** The sponsor's own number, else the linked sponsor's WhatsApp / phone. */
const phoneOf = (s: EventSponsorRow) => s.phone || s.sponsors?.whatsapp || s.sponsors?.phone || null;

function EventTags({ events, star }: { events: ObservanceView[]; star: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {events.map((e) => (
        <span key={e.id} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]', OBSERVANCE_CHIP[e.event_key])}>{e.label.icon} {e.label.ta}</span>
      ))}
      {star && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] bg-warning/15 text-warning-foreground">⭐ Star day</span>}
    </span>
  );
}

/** "Today's Event Wishes (இன்றைய விசேஷ வாழ்த்துகள்)" on the Monthly Sponsors page. */
export function EventWishesCard({ sponsors, events, today, starToday, starTomorrow, paymentBySponsor, onMarkPaid }: Props) {
  const { appUser } = useAuth();
  const tomorrow = addDays(today, 1);
  const [ctx, setCtx] = useState<EventWishContext | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [stepping, setStepping] = useState<number | null>(null);

  useEffect(() => { loadEventWishContext().then(setCtx); }, []);
  const loadSent = useCallback(() => { loadEventWishSent([today, tomorrow]).then(setSent); }, [today, tomorrow]);
  useEffect(() => { loadSent(); }, [loadSent]);

  const todayEvents = useMemo(() => events.filter((e) => e.on === today && !e.is_hidden), [events, today]);
  const tomorrowEvents = useMemo(() => events.filter((e) => e.on === tomorrow && !e.is_hidden), [events, tomorrow]);
  const todayWishes = useMemo(() => eventWishesOn(sponsors, events, today), [sponsors, events, today]);
  const tomorrowWishes = useMemo(() => eventWishesOn(sponsors, events, tomorrow), [sponsors, events, tomorrow]);
  const nextDay = useMemo(() => {
    if (todayEvents.length) return null;
    const day = eventDays(events).find((d) => d.date > today);
    return day ? { ...day, count: eventWishesOn(sponsors, day.events, day.date).length } : null;
  }, [events, sponsors, today, todayEvents.length]);

  const messageOf = (w: EventWish<EventSponsorRow>, date: string) =>
    ctx ? buildEventWishMessage(ctx.templates, w.sponsor.name, w.events, date, w.amount, ctx.organizationNames) : '';
  const isSent = (w: EventWish<EventSponsorRow>, date: string) => w.events.every((e) => sent.has(sentKey(w.sponsor.id, e.event_key, date)));

  async function record(w: EventWish<EventSponsorRow>, date: string, channel: 'whatsapp' | 'copy', message: string) {
    setSent((s) => new Set([...Array.from(s), ...w.events.map((e) => sentKey(w.sponsor.id, e.event_key, date))]));
    await logEventWish({ sponsorId: w.sponsor.id, eventKeys: w.events.map((e) => e.event_key), date, channel, message, userId: appUser?.id });
    if (channel === 'whatsapp') {
      const phone = phoneOf(w.sponsor);
      logMessage({
        sponsorId: w.sponsor.sponsor_id, sponsorName: w.sponsor.name, sponsorPhone: phone, monthlySponsorId: w.sponsor.id, sponsorCategory: 'monthly',
        messageType: 'event_wish', typeLabel: `Monthly Event Wish – ${w.events.map((e) => e.label.en).join(' & ')}`,
        relatedEventId: `obs:${w.sponsor.id}`, occurrenceDate: date, messageText: message, recipient: 'sponsor', recipientPhone: whatsappNumber(phone),
        channel: 'whatsapp_link', status: 'opened', by: { id: appUser?.id, name: appUser?.full_name || appUser?.email },
      });
    }
    loadSent();
  }

  async function copy(w: EventWish<EventSponsorRow>, date: string) {
    const message = messageOf(w, date);
    try { await navigator.clipboard.writeText(message); } catch { /* the Send Wish button still works */ }
    setCopied(w.sponsor.id);
    setTimeout(() => setCopied((c) => (c === w.sponsor.id ? null : c)), 2000);
    record(w, date, 'copy', message);
  }

  const sendable = todayWishes.filter((w) => whatsappNumber(phoneOf(w.sponsor)));
  const step = stepping != null ? sendable[stepping] : null;

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Today&apos;s Event Wishes</h2>
          <p className="text-sm text-muted-foreground">இன்றைய விசேஷ வாழ்த்துகள் · {formatStarDate(today)}</p>
        </div>
        {sendable.length > 1 && (
          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" disabled={!ctx} onClick={() => setStepping(Math.max(0, sendable.findIndex((w) => !isSent(w, today))))}>
            <Send className="h-4 w-4 mr-1.5" />Send to all ({sendable.length})
          </Button>
        )}
      </div>

      {todayEvents.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {todayEvents.map((e) => (
              <span key={e.id} className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium', OBSERVANCE_CHIP[e.event_key])}>
                {e.label.icon} {e.label.ta} <span className="font-normal opacity-80">· {e.label.en}</span>
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {todayWishes.map((w) => {
              const phone = phoneOf(w.sponsor);
              const number = whatsappNumber(phone);
              const message = messageOf(w, today);
              const done = isSent(w, today);
              const paid = paymentBySponsor.get(w.sponsor.id)?.status === 'paid';
              return (
                <div key={w.sponsor.id} className="rounded-xl border border-border p-3 flex flex-col md:flex-row md:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => openMonthlySponsorDrawer(w.sponsor.id)} className="font-medium hover:text-primary text-left">{w.sponsor.name}</button>
                      <EventTags events={w.events} star={starToday.has(w.sponsor.id)} />
                      {done && <Badge variant="outline" className="text-success border-success/40"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      {phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{phone}</a> : <span>No phone number</span>}
                      <span className="font-medium text-foreground">{w.amount != null ? formatCurrency(w.amount) : '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {number && ctx ? (
                      <a href={buildWhatsAppUrl(number, message)} target="_blank" rel="noreferrer" onClick={() => record(w, today, 'whatsapp', message)}>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"><MessageCircle className="h-4 w-4 mr-1.5" />Send Wish</Button>
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" disabled title={number ? 'Loading…' : 'No mobile number saved'}><MessageCircle className="h-4 w-4 mr-1.5" />Send Wish</Button>
                    )}
                    <Button size="sm" variant="outline" disabled={!ctx} onClick={() => copy(w, today)}>
                      <Copy className="h-4 w-4 mr-1.5" />{copied === w.sponsor.id ? 'Copied' : 'Copy message'}
                    </Button>
                    <Button size="sm" variant={paid ? 'ghost' : 'outline'} onClick={() => onMarkPaid(w.sponsor)}>{paid ? 'Paid ✓' : 'Mark paid'}</Button>
                  </div>
                </div>
              );
            })}
            {todayWishes.length === 0 && <p className="text-sm text-muted-foreground">No active monthly sponsor has today&apos;s event.</p>}
          </div>
        </>
      ) : nextDay ? (
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <div className="text-muted-foreground">No event today. Next event:</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="font-medium">{shortDay(nextDay.date)}</span>
            {nextDay.events.map((e) => (
              <span key={e.id} className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs', OBSERVANCE_CHIP[e.event_key])}>{e.label.icon} {e.label.ta} · {e.label.en}</span>
            ))}
            <span className="text-muted-foreground">· {whenLabel(daysBetween(today, nextDay.date))} · {nextDay.count} sponsor{nextDay.count === 1 ? '' : 's'}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No observance dates loaded for the coming weeks.</p>
      )}

      {tomorrowEvents.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium">Tomorrow · நாளை</span>
            <span className="text-muted-foreground">{shortDay(tomorrow)}</span>
            {tomorrowEvents.map((e) => (
              <span key={e.id} className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs', OBSERVANCE_CHIP[e.event_key])}>{e.label.icon} {e.label.ta}</span>
            ))}
          </div>
          {tomorrowWishes.length > 0 ? (
            <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
              {tomorrowWishes.map((w) => (
                <li key={w.sponsor.id} className="text-sm flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                  <button type="button" onClick={() => openMonthlySponsorDrawer(w.sponsor.id)} className="hover:text-primary truncate text-left">{w.sponsor.name}</button>
                  {starTomorrow.has(w.sponsor.id) && <span title="Star day too">⭐</span>}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{w.amount != null ? formatCurrency(w.amount) : ''}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted-foreground mt-1">No sponsors for tomorrow&apos;s event.</p>}
        </div>
      )}

      <Dialog open={stepping != null} onOpenChange={(o) => !o && setStepping(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send to all · {stepping != null && step ? `${stepping + 1} of ${sendable.length}` : 'Done'}</DialogTitle>
          </DialogHeader>
          {step ? (() => {
            const message = messageOf(step, today);
            const number = whatsappNumber(phoneOf(step.sponsor))!;
            const next = () => setStepping((i) => (i == null ? null : i + 1 < sendable.length ? i + 1 : sendable.length));
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{step.sponsor.name}</span>
                  <EventTags events={step.events} star={starToday.has(step.sponsor.id)} />
                  {isSent(step, today) && <Badge variant="outline" className="text-success border-success/40">✓ Sent</Badge>}
                </div>
                <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">{message}</div>
                <div className="flex flex-wrap gap-2">
                  <a href={buildWhatsAppUrl(number, message)} target="_blank" rel="noreferrer" onClick={() => { record(step, today, 'whatsapp', message); next(); }}>
                    <Button className="bg-green-600 hover:bg-green-700 text-white"><MessageCircle className="h-4 w-4 mr-1.5" />Open WhatsApp &amp; next</Button>
                  </a>
                  <Button variant="outline" onClick={next}>Skip<ChevronRight className="h-4 w-4 ml-1" /></Button>
                  <Button variant="ghost" disabled={stepping === 0} onClick={() => setStepping((i) => Math.max(0, (i || 0) - 1))}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
                </div>
              </div>
            );
          })() : (
            <div className="space-y-3 text-sm">
              <p>All {sendable.length} sponsors done. {sendable.filter((w) => isSent(w, today)).length} marked ✓ Sent.</p>
              <Button variant="outline" onClick={() => setStepping(null)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
