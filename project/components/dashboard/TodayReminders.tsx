'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, CheckCircle2, Heart, MessageCircle, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SponsorWishDialog } from '@/components/shared/SponsorWishDialog';
import { ThankYouDialog } from '@/components/shared/ThankYouDialog';
import { useAuth } from '@/lib/auth-context';
import { normalizeDonationType } from '@/lib/constants';
import { openMonthlySponsorDrawer, openSponsorDrawer } from '@/lib/drawer-store';
import { setReminderDone, type ReminderData } from '@/lib/today-reminders-store';
import { buildDailySummary, formatTimeIST, isSummaryOverdue, messagingSettingsFrom, type MessagingSettings } from '@/lib/messaging';
import { logMessage, sendViaApi } from '@/lib/message-service';
import { occasionSendLabel } from '@/lib/occasion-details';
import { loadWishContext } from '@/lib/star-wish';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { ReminderItem } from '@/lib/today-reminders';
import type { Donation, SpecialOccasion, Sponsor } from '@/lib/types';
import { cn } from '@/lib/utils';

const NOTIFIED_KEY = 'vp_today_notified';

/** Desktop notification at most once a day, if the browser allows it. */
function notifyOncePerDay(count: number, today: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (window.localStorage.getItem(NOTIFIED_KEY) === today) return;
    new Notification('VP Trust', { body: `You have ${count} reminder${count === 1 ? '' : 's'} today` });
    window.localStorage.setItem(NOTIFIED_KEY, today);
  } catch {
    // Some mobile browsers only allow notifications from the service worker.
  }
}

interface TodayRemindersProps {
  data: ReminderData | null;
  onChanged: () => void;
}

/** "Today's Reminders (Live)": birthdays and events / donation days happening today. */
export function TodayReminders({ data, onChanged }: TodayRemindersProps) {
  const { appUser } = useAuth();
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const [wish, setWish] = useState<ReminderItem | null>(null);
  const [thanks, setThanks] = useState<{ sponsor: Sponsor; donation: Donation; eventKey: string } | null>(null);
  const [canAsk, setCanAsk] = useState(false);
  const announced = useRef<string | null>(null);
  const [settings, setSettings] = useState<MessagingSettings>(messagingSettingsFrom(null));

  const today = data?.items.filter((i) => i.group === 'today') || [];
  const isDone = (i: ReminderItem) => localDone[i.key] ?? data?.done.has(i.key) ?? false;
  const pending = today.filter((i) => !isDone(i)).length;

  useEffect(() => {
    setCanAsk('Notification' in window && Notification.permission === 'default');
    loadWishContext().then((c) => setSettings(c.messaging));
  }, []);

  // Announce once for each day this dashboard stays open.
  useEffect(() => {
    if (!data || announced.current === data.today) return;
    announced.current = data.today;
    setLocalDone({});
    if (pending > 0) {
      toast.info(`You have ${pending} reminder${pending === 1 ? '' : 's'} today`);
      notifyOncePerDay(pending, data.today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function toggleDone(item: ReminderItem) {
    if (!data) return;
    const next = !isDone(item);
    setLocalDone((m) => ({ ...m, [item.key]: next }));
    await setReminderDone(item.key, data.today, next, appUser?.id);
    onChanged();
  }

  async function enableAlerts() {
    await Notification.requestPermission();
    setCanAsk(false);
    if (data && pending > 0) notifyOncePerDay(pending, data.today);
  }

  const employee = { id: appUser?.id, name: appUser?.full_name || appUser?.email };
  const summaryText = data ? buildDailySummary(data.items, data.today) : '';
  const summaryBase = {
    messageType: 'admin_daily_summary' as const, typeLabel: 'Admin Daily Summary', occurrenceDate: data?.today || '', messageText: summaryText,
    recipient: 'admin' as const, recipientPhone: settings.adminNumber, by: employee,
  };
  async function sendSummaryAutomatic() {
    const result = await sendViaApi(settings.adminNumber, summaryText);
    await logMessage({ ...summaryBase, channel: 'whatsapp_api', status: result.success ? 'sent' : 'failed', errorMessage: result.error, providerMessageId: result.messageId });
    if (result.success) toast.success('Summary sent to admin');
    else toast.error('Automatic send failed. Change to Manual mode in Settings to use the WhatsApp link.');
    onChanged();
  }
  const summarySent = !!data?.summaryLog;

  const birthdays = today.filter((i) => i.kind === 'birthday');
  const events = today.filter((i) => i.kind !== 'birthday');

  const group = (title: string, items: ReminderItem[], empty: string) => (
    <div className="rounded-xl border border-amber-200 bg-background p-4">
      <h3 className="font-semibold text-sm mb-3">{title} <span className="text-muted-foreground font-normal">({items.length})</span></h3>
      <div className="space-y-3">
        {items.map((item) => {
          const done = isDone(item);
          const donation = item.donation || (item.sponsor ? data?.latestDonation.get(item.sponsor.id) : undefined);
          const open = () => {
            if (item.sponsor) openSponsorDrawer(item.sponsor.id, { occasionId: item.occasionRecord?.id });
            else if (item.monthlySponsor) openMonthlySponsorDrawer(item.monthlySponsor.id);
          };
          return (
            <div key={item.key} className={cn('rounded-lg border p-3', item.calm ? 'border-slate-300 bg-slate-50' : 'border-border', done && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={open} className="font-medium hover:text-primary text-left">{item.occasion}</button>
                  {item.recurrenceBadge && <Badge variant="secondary" className="ml-2 text-xs font-normal">{item.recurrenceBadge}</Badge>}
                  {item.donationType && <div className="text-sm text-muted-foreground">Donation: {normalizeDonationType(item.donationType)}</div>}
                  <div className="text-sm text-muted-foreground mt-0.5">
                    Contact: {item.contactName || item.name}
                    {item.phone && <> · <a href={`tel:${item.phone}`} className="hover:text-foreground">{item.phone}</a></>}
                  </div>
                </div>
                {done && <Badge variant="outline" className="text-success border-success/30 bg-success/10">Done</Badge>}
              </div>
              {(data?.messagesByKey.get(item.key) || []).slice(0, 1).map((m) => (
                <p key={m.id} className={cn('text-xs mt-2', m.status === 'opened' ? 'text-muted-foreground' : 'text-success')}>
                  {m.status === 'opened' ? 'WhatsApp opened, not confirmed' : `✓ ${m.message_type === 'donation_thanks' ? 'Thanks' : 'Wish'} sent at ${formatTimeIST(m.sent_at)}${m.sent_by_name ? ` by ${m.sent_by_name}` : ''}`}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => setWish(item)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />{item.occasionRecord ? occasionSendLabel(item.occasionRecord) : item.kind === 'birthday' ? 'Send Birthday Wish' : 'Send WhatsApp Wish'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!donation || !item.sponsor}
                  title={donation ? undefined : 'No donation recorded for this person yet'}
                  onClick={() => { if (donation && item.sponsor) setThanks({ sponsor: item.sponsor, donation, eventKey: item.key }); }}
                >
                  <Heart className="h-3.5 w-3.5 mr-1.5" />Send Thanks
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleDone(item)}>
                  {done ? <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  {done ? 'Undo' : 'Mark as Done'}
                </Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );

  // A monthly sponsor may have no sponsor record: send to their number without logging.
  const wishSponsor: Sponsor | null = wish
    ? wish.sponsor || ({ id: wish.monthlySponsor?.id, full_name: wish.personName, preferred_name: null, phone: wish.phone, whatsapp: wish.phone } as Sponsor)
    : null;
  // Birthdays stored only as a date of birth have no occasion row; describe them for the template.
  const wishOccasion = wish
    ? wish.occasionRecord || ({
      occasion_type: wish.kind === 'birthday' ? 'Birthday' : 'Other',
      person_name: wish.personName,
      family_member_id: wish.familyMember ? wish.key : null,
    } as SpecialOccasion)
    : null;

  return (
    <Card className="p-5 border-2 border-amber-400 bg-amber-50/50 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-amber-600" />
          <h2 className="font-semibold">🔔 Today&apos;s Reminders (Live)</h2>
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Today: {today.length}</Badge>
        </div>
        {canAsk && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={enableAlerts}>Enable desktop alerts</Button>}
      </div>
      {data && settings.dailySummaryEnabled && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {summarySent ? (
            <span className="text-success">✓ Today&apos;s summary sent to {settings.adminName} at {formatTimeIST(data.summaryLog!.sent_at)}</span>
          ) : settings.sendMode === 'automatic' ? (
            <Button size="sm" variant="outline" onClick={sendSummaryAutomatic}>📤 Send Today&apos;s Summary to Admin</Button>
          ) : (
            <a
              href={buildWhatsAppUrl(settings.adminNumber, summaryText)}
              target="_blank"
              rel="noreferrer"
              onClick={() => { logMessage({ ...summaryBase, channel: 'whatsapp_link', status: 'opened' }).then(onChanged); }}
            >
              <Button size="sm" variant="outline">📤 Send Today&apos;s Summary to Admin</Button>
            </a>
          )}
          {isSummaryOverdue(settings, summarySent) && <span className="text-destructive">Today&apos;s summary hasn&apos;t been sent yet.</span>}
        </div>
      )}
      {!data ? (
        <div className="h-24 rounded-xl bg-amber-100/50 animate-pulse" />
      ) : today.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">No events or birthdays today 🙏</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {group('🎂 Birthdays Today', birthdays, 'No birthdays today.')}
          {group('📅 Events / Donation Days Today', events, 'No events today.')}
        </div>
      )}

      {wishSponsor && (
        <SponsorWishDialog
          sponsor={wishSponsor}
          occasion={wishOccasion}
          occasionDate={data?.today}
          open
          skipLog={!wish?.sponsor}
          relatedEventId={wish?.key}
          onOpenChange={(o) => { if (!o) setWish(null); }}
          onSent={onChanged}
        />
      )}
      {thanks && (
        <ThankYouDialog
          sponsor={thanks.sponsor}
          donation={thanks.donation}
          relatedEventId={thanks.eventKey}
          occurrenceDate={data?.today}
          onOpenChange={(o) => { if (!o) setThanks(null); }}
          onSent={onChanged}
        />
      )}
    </Card>
  );
}
