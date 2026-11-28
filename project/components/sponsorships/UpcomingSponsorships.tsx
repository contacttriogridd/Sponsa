'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellRing, CheckCircle2, MessageCircle, MoreVertical, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PhoneLink } from '@/components/shared/PhoneLink';
import { SponsorWishDialog } from '@/components/shared/SponsorWishDialog';
import { useAuth } from '@/lib/auth-context';
import { amountLabel } from '@/lib/amount';
import { buildCallLink, displayPhone } from '@/lib/phone';
import { formatSentAt } from '@/lib/messaging';
import { formatStarDate } from '@/lib/monthly-sponsors';
import { openMonthlySponsorDrawer, openSponsorDrawer } from '@/lib/drawer-store';
import { GROUPS, NOT_REQUESTED, STAGES, STATUS_LABELS, stageForDays, type Slot, type Stage, type UpcomingEvent } from '@/lib/upcoming-sponsorships';
import { markReminderSent, setEventStatus, type SentReminder } from '@/lib/upcoming-sponsorships-store';
import { cn } from '@/lib/utils';
import type { SpecialOccasion, Sponsor } from '@/lib/types';
import { MonthlyRequestPreview } from '@/components/monthly/MonthlyRequestPreview';
import { loadMonthRequests, type RequestSponsor } from '@/lib/monthly-requests-store';
import type { RequestStatus } from '@/lib/monthly-requests';

const FLOW = ['requested', 'confirmed', 'paid', 'declined', 'no_response', 'completed'];

const statusClass: Record<string, string> = {
  not_requested: 'bg-muted text-muted-foreground border border-dashed border-border',
  requested: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100',
  confirmed: 'bg-primary/10 text-primary',
  paid: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  declined: 'bg-destructive/10 text-destructive',
  no_response: 'bg-muted text-muted-foreground',
};

/** "D-3 ✓ Sent 21 Nov, 10:15 AM" (green) · "D-2 • Pending" (grey) · "D-1 Missed" (amber). */
export function ReminderChip({ slot }: { slot: Slot }) {
  if (slot.state === 'sent' && slot.sent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[11px] font-medium" title={`${slot.sent.channel}${slot.sent.sent_by_name ? ` · by ${slot.sent.sent_by_name}` : ''}`}>
        <CheckCircle2 className="h-3 w-3" />{slot.stage} Sent {formatSentAt(slot.sent.sent_at).replace(/ \d{4},/, ',')}
      </span>
    );
  }
  if (slot.state === 'missed') return <span className="inline-flex rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100 px-2 py-0.5 text-[11px] font-medium">{slot.stage} Missed</span>;
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', slot.state === 'due' ? 'bg-muted text-foreground ring-1 ring-warning' : 'bg-muted text-muted-foreground')}>
      {slot.stage} • {slot.state === 'due' ? 'Pending (due today)' : 'Pending'}
    </span>
  );
}

/** The sponsor and occasion the wish dialog needs (as the dashboard builds them). */
function wishTarget(e: UpcomingEvent): { sponsor: Sponsor; occasion: SpecialOccasion } {
  const i = e.item;
  const sponsor = i.sponsor || ({ id: i.monthlySponsor?.id, full_name: i.personName, preferred_name: null, phone: i.phone, whatsapp: i.phone } as Sponsor);
  const occasion = i.occasionRecord || ({ occasion_type: i.kind === 'birthday' ? 'Birthday' : 'Other', person_name: i.personName, family_member_id: i.familyMember ? i.key : null } as SpecialOccasion);
  return { sponsor, occasion };
}

function openRecord(e: UpcomingEvent) {
  if (e.item.sponsor) openSponsorDrawer(e.item.sponsor.id);
  else if (e.item.monthlySponsor) openMonthlySponsorDrawer(e.item.monthlySponsor.id);
}

function EventRow({ e, onChanged }: { e: UpcomingEvent; onChanged: () => void }) {
  const { appUser } = useAuth();
  const [sending, setSending] = useState(false);
  const monthlyRequest = e.key.startsWith('mspay:') && e.item.monthlySponsor;
  const todayStage = stageForDays(e.days);
  const by = { id: appUser?.id, name: appUser?.full_name || appUser?.email };
  const statuses = FLOW.includes(e.status) ? FLOW : [...FLOW, e.status].filter((s) => s !== NOT_REQUESTED);

  async function mark(stage: Stage, channel: 'manual' | 'call' | 'whatsapp' | 'sms') {
    const err = await markReminderSent(e, stage, channel, by);
    if (err) toast.error(err); else { toast.success(`${stage} marked as sent`); onChanged(); }
  }
  async function status(v: string) {
    const err = await setEventStatus(e, v, appUser?.id);
    if (err) toast.error(err.includes('check') ? 'This status needs database migration 00028.' : 'Unable to change the status.');
    else onChanged();
  }

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg" aria-hidden>{e.item.icon}</span>
            <button type="button" onClick={() => openRecord(e)} className="font-semibold hover:text-primary text-left">{e.name}</button>
            <Badge variant="secondary" className="text-xs font-normal">{e.category}</Badge>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusClass[e.status] || statusClass.no_response)}>{STATUS_LABELS[e.status] || e.status}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {formatStarDate(e.date)} · {e.occasion}
            {e.foodType ? ` · ${e.foodType}` : ''}
            {e.people ? ` · ${e.people} people` : ''}
            {` · ${amountLabel(e.amount)}`}
            {e.item.phone ? ` · ${displayPhone(e.item.phone)}` : ''}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {e.slots.map((s) => <ReminderChip key={s.stage} slot={s} />)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Select value={e.status === NOT_REQUESTED ? undefined : e.status} onValueChange={status}>
            <SelectTrigger className="h-9 w-36" aria-label="Status"><SelectValue placeholder="Not requested" /></SelectTrigger>
            <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}</SelectContent>
          </Select>
          {e.item.phone && (
            <PhoneLink href={buildCallLink(e.item.phone)} onEdit={() => openRecord(e)}>
              <Button variant="outline" size="icon" aria-label="Call"><Phone className="h-4 w-4" /></Button>
            </PhoneLink>
          )}
          <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => setSending(true)}>
            <MessageCircle className="h-4 w-4 mr-1.5" />{todayStage ? `Send ${todayStage} reminder` : 'Send message'}
          </Button>
          {e.item.sponsor
            ? <Link href={`/sponsors/${e.item.sponsor.id}`}><Button variant="outline" size="sm">View</Button></Link>
            : <Button variant="outline" size="sm" onClick={() => openRecord(e)}>View</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Mark reminder sent"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mark reminder sent (outside the app)</DropdownMenuLabel>
              {STAGES.map((st) => (
                <DropdownMenuItem key={st} disabled={e.slots.find((x) => x.stage === st)?.state === 'sent'} onClick={() => mark(st, 'manual')}>
                  {st} — sent{st === todayStage ? ' (today)' : ''}
                </DropdownMenuItem>
              ))}
              {todayStage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => mark(todayStage, 'call')}>{todayStage} — reminded by phone call</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {sending && (monthlyRequest ? (
        <UpcomingMonthlyRequest sponsorId={e.item.monthlySponsor!.id} month={`${e.date.slice(0, 7)}-01`} onClose={() => { setSending(false); onChanged(); }} />
      ) : (
        <SponsorWishDialog
          sponsor={wishTarget(e).sponsor}
          occasion={wishTarget(e).occasion}
          occasionDate={e.date}
          relatedEventId={e.key}
          skipLog={!e.item.sponsor}
          open
          onOpenChange={(o) => { if (!o) { setSending(false); onChanged(); } }}
          onSent={onChanged}
        />
      ))}
    </Card>
  );
}

const matches = (e: UpcomingEvent, q: string) => !q || `${e.name} ${e.occasion} ${e.category}`.toLowerCase().includes(q.toLowerCase());

/** "Upcoming (3 days)": Today / Tomorrow / 2 days / 3 days, every status included. */
export function UpcomingView({ events, query, onChanged }: { events: UpcomingEvent[]; query: string; onChanged: () => void }) {
  const shown = events.filter((e) => matches(e, query));
  if (!shown.length) return <Empty text={query ? 'No upcoming events match your search.' : 'No sponsor events in the next 3 days.'} />;
  return (
    <div className="space-y-5">
      {GROUPS.map((g) => {
        const list = shown.filter((e) => e.days === g.days);
        if (!list.length) return null;
        return (
          <section key={g.days} className="space-y-2">
            <h2 className="font-semibold text-sm">{g.en} <span className="text-muted-foreground font-normal">({g.ta}) · {list.length}</span></h2>
            <div className="grid gap-2">{list.map((e) => <EventRow key={`${e.key}|${e.date}`} e={e} onChanged={onChanged} />)}</div>
          </section>
        );
      })}
    </div>
  );
}

/** "Reminder pending": upcoming events whose reminder for today's stage is not sent yet. */
export function PendingView({ events, query, onChanged }: { events: UpcomingEvent[]; query: string; onChanged: () => void }) {
  const shown = events.filter((e) => matches(e, query));
  if (!shown.length) return <Empty text={query ? 'No pending reminders match your search.' : "All of today's reminders are sent."} icon />;
  return <div className="grid gap-2">{shown.map((e) => <EventRow key={`${e.key}|${e.date}`} e={e} onChanged={onChanged} />)}</div>;
}

/** "Reminder sent": every event with at least one reminder, the stages sent and when. */
export function SentView({ rows, query }: { rows: SentReminder[]; query: string }) {
  const groups = new Map<string, SentReminder[]>();
  for (const r of rows) groups.set(`${r.event_key}|${r.event_date}`, [...(groups.get(`${r.event_key}|${r.event_date}`) || []), r]);
  const list = Array.from(groups.values())
    .map((g) => ({ rows: g.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)), name: g[0].sponsors?.full_name || g[0].monthly_sponsors?.name || 'Sponsor', date: g[0].event_date }))
    .filter((g) => !query || g.name.toLowerCase().includes(query.toLowerCase()) || g.rows.some((r) => (r.message_preview || '').toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return <Empty text={query ? 'No sent reminders match your search.' : 'No reminders sent yet.'} />;
  return (
    <div className="grid gap-2">
      {list.map((g) => (
        <Card key={`${g.rows[0].event_key}|${g.date}`} className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {g.rows[0].sponsor_id
              ? <Link href={`/sponsors/${g.rows[0].sponsor_id}`} className="font-semibold hover:text-primary">{g.name}</Link>
              : <button type="button" onClick={() => g.rows[0].monthly_sponsor_id && openMonthlySponsorDrawer(g.rows[0].monthly_sponsor_id)} className="font-semibold hover:text-primary text-left">{g.name}</button>}
            <span className="text-sm text-muted-foreground">event {formatStarDate(g.date)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {g.rows.map((r) => (
              <ReminderChip key={r.id} slot={{ stage: r.stage, due: '', state: 'sent', sent: r }} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Empty({ text, icon }: { text: string; icon?: boolean }) {
  return (
    <Card className="py-12 text-center">
      {icon ? <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" /> : <BellRing className="h-8 w-8 text-muted-foreground mx-auto mb-2" />}
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}

/** A monthly sponsor's donation day: this month's sponsorship request, in the request preview. */
function UpcomingMonthlyRequest({ sponsorId, month, onClose }: { sponsorId: string; month: string; onClose: () => void }) {
  const [row, setRow] = useState<RequestStatus<RequestSponsor> | null>(null);
  useEffect(() => {
    loadMonthRequests(month).then(({ rows }) => {
      const r = rows.find((x) => x.sponsor.id === sponsorId);
      if (r) setRow(r); else { toast.error('This monthly sponsor is not active.'); onClose(); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId, month]);
  return <MonthlyRequestPreview row={row} month={month} open onOpenChange={(o) => { if (!o) onClose(); }} />;
}
