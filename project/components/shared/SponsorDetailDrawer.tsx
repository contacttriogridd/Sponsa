'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, CheckCircle2, Edit, ExternalLink, ListPlus, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DatePicker } from '@/components/shared/DatePicker';
import { SponsorForm } from '@/components/shared/SponsorForm';
import { OccasionForm } from '@/components/shared/OccasionForm';
import { SponsorWishDialog } from '@/components/shared/SponsorWishDialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { nextOccurrenceOf, daysUntil } from '@/lib/date-utils';
import { occasionHeadline, occasionRelation } from '@/lib/occasion-text';
import { OCCASION_ICONS, SPONSORSHIP_STATUS_LABELS, formatCurrency, formatDateShort, normalizeDonationType } from '@/lib/constants';
import { STARS } from '@/lib/natchathiram';
import { daysBetween, todayIst, whenLabel } from '@/lib/monthly-sponsors';
import { addDays, starDaysFor } from '@/lib/star-days';
import { loadStarCalendar } from '@/lib/star-calendar-store';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { whatsappNumber } from '@/lib/star-wish';
import { closeDrawer, notifyDrawerDataChanged, openMonthlySponsorDrawer } from '@/lib/drawer-store';
import { cn } from '@/lib/utils';
import type { Donation, Interaction, MonthlySponsor, SpecialOccasion, Sponsor, SponsorshipRequest, Task } from '@/lib/types';

interface ReminderRow {
  id: string;
  reminder_date: string;
  days_before: number;
  status: string;
  special_occasions: { occasion_type: string; person_name: string } | null;
}

interface DrawerData {
  sponsor: Sponsor;
  occasions: SpecialOccasion[];
  donations: Donation[];
  requests: SponsorshipRequest[];
  tasks: Task[];
  reminders: ReminderRow[];
  interactions: Interaction[];
  monthly: MonthlySponsor[];
}

interface UpcomingDay {
  key: string;
  icon: string;
  title: string;
  subtitle: string | null;
  dateKey: string;
  daysUntil: number;
  occasion?: SpecialOccasion;
  monthlyId?: string;
}

const dateKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const longDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Green for today, amber within a week. */
function countdownClass(days: number): string {
  if (days === 0) return 'bg-success/15 text-success border-success/30';
  if (days <= 7) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function SponsorDetailDrawer({ sponsorId, occasionId, open }: { sponsorId: string; occasionId?: string; open: boolean }) {
  const { appUser } = useAuth();
  const [data, setData] = useState<DrawerData | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingDay[]>([]);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'edit' | 'wish' | 'followup' | 'occasion' | null>(null);
  const [contacted, setContacted] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [s, occ, don, req, tasks, rem, inter, monthly] = await Promise.all([
      supabase.from('sponsors').select('*').eq('id', sponsorId).maybeSingle(),
      supabase.from('special_occasions').select('*').eq('sponsor_id', sponsorId).eq('active', true),
      supabase.from('donations').select('*').eq('sponsor_id', sponsorId).order('donation_date', { ascending: false }),
      supabase.from('sponsorship_requests').select('*').eq('sponsor_id', sponsorId).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('sponsor_id', sponsorId).order('due_date', { ascending: true }),
      supabase.from('reminders').select('id, reminder_date, days_before, status, special_occasions(occasion_type, person_name)')
        .eq('sponsor_id', sponsorId).order('reminder_date', { ascending: false }).limit(20),
      supabase.from('interactions').select('*').eq('sponsor_id', sponsorId).order('interaction_date', { ascending: false }).limit(20),
      supabase.from('monthly_sponsors').select('*').eq('sponsor_id', sponsorId).neq('status', 'stopped'),
    ]);
    if (!s.data) { setError('Sponsor not found.'); return; }
    const next: DrawerData = {
      sponsor: s.data as Sponsor,
      occasions: (occ.data || []) as SpecialOccasion[],
      donations: (don.data || []) as Donation[],
      requests: (req.data || []) as SponsorshipRequest[],
      tasks: (tasks.data || []) as Task[],
      reminders: (rem.data || []) as unknown as ReminderRow[],
      interactions: (inter.data || []) as Interaction[],
      monthly: monthly.error ? [] : (monthly.data || []) as MonthlySponsor[],
    };
    setData(next);

    // Every special day, nearest first: occasions plus star days of linked monthly sponsors.
    const now = new Date();
    const days: UpcomingDay[] = [];
    for (const o of next.occasions) {
      const n = nextOccurrenceOf(o, now);
      if (!n) continue;
      days.push({
        key: o.id,
        icon: OCCASION_ICONS[o.occasion_type] || '⭐',
        title: occasionHeadline(o, next.sponsor.full_name),
        subtitle: occasionRelation(o, next.sponsor.full_name),
        dateKey: dateKeyOf(n.date),
        daysUntil: daysUntil(n.date, now),
        occasion: o,
      });
    }
    const withStar = next.monthly.filter((m) => m.star != null);
    if (withStar.length) {
      const today = todayIst();
      const rows = await loadStarCalendar(addDays(today, -1), addDays(today, 30));
      for (const m of withStar) {
        const occurrence = starDaysFor(m.star!, rows).find((x) => x.date >= today);
        if (!occurrence) continue;
        days.push({
          key: `star-${m.id}`,
          icon: '⭐',
          title: `Star day — ${STARS[m.star!].ta} (${STARS[m.star!].en})`,
          subtitle: m.name !== next.sponsor.full_name ? `${m.name}${m.relationship ? ` (${m.relationship})` : ''}` : null,
          dateKey: occurrence.date,
          daysUntil: daysBetween(today, occurrence.date),
          monthlyId: m.id,
        });
      }
    }
    setUpcoming(days.sort((a, b) => a.daysUntil - b.daysUntil));
  }, [sponsorId]);

  useEffect(() => {
    setData(null); setUpcoming([]); setContacted(false);
    load();
  }, [load]);

  const highlighted = useMemo(
    () => upcoming.find((d) => d.occasion?.id === occasionId) || null,
    [upcoming, occasionId],
  );
  // Send Wish uses the highlighted occasion, else the nearest one.
  const wishDay = highlighted || upcoming.find((d) => d.occasion) || null;

  async function markContacted() {
    if (!data) return;
    const today = new Date().toISOString().split('T')[0];
    await Promise.all([
      supabase.from('sponsors').update({ last_contact_date: today }).eq('id', data.sponsor.id),
      supabase.from('interactions').insert({
        sponsor_id: data.sponsor.id,
        type: 'other',
        summary: `Marked as contacted${highlighted?.occasion ? ` (${highlighted.occasion.occasion_type})` : ''}`,
        interaction_date: new Date().toISOString(),
        conducted_by: appUser?.id || null,
      }),
      occasionId
        ? supabase.from('reminders').update({ status: 'sent' }).eq('occasion_id', occasionId).eq('status', 'pending')
        : Promise.resolve(),
    ]);
    setContacted(true);
    notifyDrawerDataChanged();
    load();
  }

  const s = data?.sponsor;
  const initials = s ? s.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase() : '';
  const alternate = s?.whatsapp && s.whatsapp !== s.phone ? s.whatsapp : null;

  const history = useMemo(() => {
    if (!data) return [];
    return [
      ...data.requests.map((r) => ({
        key: `r-${r.id}`, kind: 'Sponsorship', date: r.special_date || r.created_at.slice(0, 10),
        amount: r.requested_amount, title: r.occasion_name || `${normalizeDonationType(r.type)} request`,
        status: SPONSORSHIP_STATUS_LABELS[r.status] || r.status,
      })),
      ...data.donations.map((d) => ({
        key: `d-${d.id}`, kind: 'Donation', date: d.donation_date,
        amount: d.amount, title: d.occasion_name || `${normalizeDonationType(d.type)} donation`, status: d.status,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const activity = useMemo(() => {
    if (!data) return [];
    return [
      ...data.interactions.map((i) => ({ key: `i-${i.id}`, date: i.interaction_date, text: i.summary || i.type, tag: i.type })),
      ...data.reminders.map((r) => ({
        key: `rem-${r.id}`, date: r.reminder_date,
        text: `Reminder: ${r.special_occasions?.occasion_type || 'occasion'}${r.special_occasions?.person_name ? ` of ${r.special_occasions.person_name}` : ''} (${r.days_before === 0 ? 'on the day' : `${r.days_before} days before`})`,
        tag: r.status,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }, [data]);

  return (
    <>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 overflow-y-auto">
        <SheetTitle className="sr-only">{s?.full_name || 'Sponsor details'}</SheetTitle>
        {error && <div className="p-6 text-sm text-muted-foreground">{error}</div>}
        {!data && !error && (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="flex items-center gap-3"><div className="h-14 w-14 rounded-full bg-muted" /><div className="space-y-2 flex-1"><div className="h-4 w-1/2 bg-muted rounded" /><div className="h-3 w-1/3 bg-muted rounded" /></div></div>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
          </div>
        )}
        {s && data && (
          <div className="pb-8">
            {/* Header */}
            <div className="p-5 pr-12 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold shrink-0">{initials}</div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{s.full_name}</h2>
                  {s.phone && <a href={`tel:${s.phone}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{s.phone}</a>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {s.phone && <a href={`tel:${s.phone}`}><Button variant="outline" size="sm"><Phone className="h-4 w-4 mr-1.5" />Call</Button></a>}
                {(s.whatsapp || s.phone) && (
                  <a href={buildWhatsAppUrl(whatsappNumber(s.whatsapp || s.phone))} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50"><MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp</Button>
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => setDialog('edit')}><Edit className="h-4 w-4 mr-1.5" />Edit</Button>
                <Link href={`/sponsors/${s.id}`} onClick={() => closeDrawer()}>
                  <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4 mr-1.5" />Full profile</Button>
                </Link>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* This reminder's occasion */}
              {highlighted && (
                <div className={cn('rounded-xl border p-4 flex items-center gap-3', countdownClass(highlighted.daysUntil))}>
                  <span className="text-2xl">{highlighted.icon}</span>
                  <div className="min-w-0">
                    <div className="font-semibold">{highlighted.occasion?.occasion_type} – {whenLabel(highlighted.daysUntil)}</div>
                    <div className="text-sm opacity-90 truncate">{highlighted.title} · {longDate(highlighted.dateKey)}</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setDialog('wish')}><Send className="h-4 w-4 mr-1.5" />Send Wish</Button>
                <Button variant="outline" onClick={markContacted} disabled={contacted}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />{contacted ? 'Contacted' : 'Mark as contacted'}
                </Button>
                <Button variant="outline" onClick={() => setDialog('followup')}><ListPlus className="h-4 w-4 mr-1.5" />Add follow-up</Button>
                <Button variant="outline" onClick={() => setDialog('occasion')}><CalendarPlus className="h-4 w-4 mr-1.5" />Add special day</Button>
              </div>

              {/* Basic details */}
              <Section title="Details">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <Detail label="Name">{s.full_name}{s.preferred_name && s.preferred_name !== s.full_name ? ` (${s.preferred_name})` : ''}</Detail>
                  <Detail label="Phone">{s.phone ? <a href={`tel:${s.phone}`} className="text-primary hover:underline">{s.phone}</a> : '—'}</Detail>
                  <Detail label="Alternate phone">{alternate ? <a href={`tel:${alternate}`} className="text-primary hover:underline">{alternate}</a> : '—'}</Detail>
                  <Detail label="Email">{s.email ? <a href={`mailto:${s.email}`} className="text-primary hover:underline inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{s.email}</a> : '—'}</Detail>
                  <Detail label="Address">{s.address ? <span className="inline-flex gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{s.address}</span> : '—'}</Detail>
                  <Detail label="Area / City">{[s.city, s.district].filter(Boolean).join(', ') || '—'}</Detail>
                  <Detail label="Date added">{formatDateShort(s.created_at)}</Detail>
                  <Detail label="Last contact">{s.last_contact_date ? formatDateShort(s.last_contact_date) : '—'}</Detail>
                  <Detail label="Notes">{s.notes || '—'}</Detail>
                </dl>
              </Section>

              {/* Upcoming special days */}
              <Section title="Upcoming special days">
                <div className="space-y-2">
                  {upcoming.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      disabled={!d.monthlyId}
                      onClick={() => d.monthlyId && openMonthlySponsorDrawer(d.monthlyId)}
                      className={cn('w-full text-left flex items-center gap-3 p-3 rounded-xl border', d.occasion?.id === occasionId ? 'border-primary' : 'border-border', d.monthlyId && 'hover:bg-muted/50')}
                    >
                      <span className="text-xl">{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.subtitle ? `${d.subtitle} · ` : ''}{longDate(d.dateKey)}</div>
                      </div>
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', countdownClass(d.daysUntil))}>{whenLabel(d.daysUntil)}</span>
                    </button>
                  ))}
                  {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No special days saved yet.</p>}
                </div>
              </Section>

              {/* Sponsorship history */}
              <Section title="Sponsorship history">
                <div className="divide-y divide-border rounded-xl border border-border">
                  {history.map((h) => (
                    <div key={h.key} className="p-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{h.title}</div>
                        <div className="text-xs text-muted-foreground">{h.kind} · {formatDateShort(h.date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{h.amount != null ? formatCurrency(Number(h.amount)) : '—'}</div>
                        <Badge variant="outline" className="text-[10px] capitalize">{h.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && <p className="p-3 text-sm text-muted-foreground">No sponsorships or donations yet.</p>}
                </div>
              </Section>

              {/* Follow-ups and reminders log */}
              <Section title="Follow-ups">
                <div className="space-y-2">
                  {data.tasks.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl border border-border flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.due_date ? `Due ${formatDateShort(t.due_date)}` : 'No due date'}{t.description ? ` · ${t.description}` : ''}</div>
                      </div>
                      <Badge variant={t.status === 'Completed' ? 'secondary' : 'outline'}>{t.status}</Badge>
                    </div>
                  ))}
                  {data.tasks.length === 0 && <p className="text-sm text-muted-foreground">No follow-ups.</p>}
                </div>
              </Section>
              <Section title="Reminders & contact log">
                <div className="space-y-2">
                  {activity.map((a) => (
                    <div key={a.key} className="flex gap-3 text-sm">
                      <div className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{formatDateShort(a.date)}</div>
                      <div className="flex-1">{a.text} <span className="text-xs text-muted-foreground capitalize">· {a.tag}</span></div>
                    </div>
                  ))}
                  {activity.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
                </div>
              </Section>
            </div>
          </div>
        )}
      </SheetContent>

      {s && data && open && (
        <>
          <Dialog open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Sponsor</DialogTitle></DialogHeader>
              <SponsorForm sponsor={s} onCancel={() => setDialog(null)} onSaved={() => { setDialog(null); notifyDrawerDataChanged(); load(); }} />
            </DialogContent>
          </Dialog>
          <Dialog open={dialog === 'occasion'} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Special Day</DialogTitle></DialogHeader>
              <OccasionForm sponsorId={s.id} defaultPersonName={s.full_name} sponsorPhone={s.whatsapp || s.phone} sponsorDob={s.dob} onCancel={() => setDialog(null)} onSaved={() => { setDialog(null); notifyDrawerDataChanged(); load(); }} />
            </DialogContent>
          </Dialog>
          <FollowUpDialog
            open={dialog === 'followup'}
            sponsor={s}
            onOpenChange={(o) => !o && setDialog(null)}
            onSaved={() => { setDialog(null); notifyDrawerDataChanged(); load(); }}
          />
          <SponsorWishDialog
            sponsor={s}
            occasion={wishDay?.occasion}
            occasionDate={wishDay?.dateKey}
            relatedEventId={wishDay?.occasion ? `occ:${wishDay.occasion.id}` : null}
            open={dialog === 'wish'}
            onOpenChange={(o) => !o && setDialog(null)}
            onSent={() => load()}
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

function FollowUpDialog({ open, sponsor, onOpenChange, onSaved }: {
  open: boolean; sponsor: Sponsor; onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const { appUser } = useAuth();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setTitle(`Follow up with ${sponsor.preferred_name || sponsor.full_name}`); setDue(''); setNotes(''); setError(''); }
  }, [open, sponsor]);

  async function save() {
    if (!title.trim()) return;
    setBusy(true); setError('');
    const { error: err } = await supabase.from('tasks').insert({
      sponsor_id: sponsor.id, title: title.trim(), description: notes.trim() || null,
      status: 'Pending', due_date: due || null, created_by: appUser?.id || null,
    });
    setBusy(false);
    if (err) { setError('Unable to save. Please try again.'); return; }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fu-title">Title</Label>
            <Input id="fu-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <DatePicker value={due} onChange={setDue} fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-notes">Notes</Label>
            <Textarea id="fu-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Add Follow-up'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
