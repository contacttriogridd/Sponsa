'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, CheckCircle2, Heart, MessageCircle, Phone, RotateCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SponsorWishDialog } from '@/components/shared/SponsorWishDialog';
import { ThankYouDialog } from '@/components/shared/ThankYouDialog';
import { useAuth } from '@/lib/auth-context';
import { normalizeDonationType } from '@/lib/constants';
import { openMonthlySponsorDrawer, openSponsorDrawer } from '@/lib/drawer-store';
import { setReminderDone, type ReminderData } from '@/lib/today-reminders-store';
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
  const [thanks, setThanks] = useState<{ sponsor: Sponsor; donation: Donation } | null>(null);
  const [canAsk, setCanAsk] = useState(false);
  const announced = useRef<string | null>(null);

  const today = data?.items.filter((i) => i.group === 'today') || [];
  const isDone = (i: ReminderItem) => localDone[i.key] ?? data?.done.has(i.key) ?? false;
  const pending = today.filter((i) => !isDone(i)).length;

  useEffect(() => {
    setCanAsk('Notification' in window && Notification.permission === 'default');
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
            <div key={item.key} className={cn('rounded-lg border border-border p-3', done && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none mt-0.5">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={open} className="font-medium hover:text-primary text-left">{item.name}</button>
                  <div className="text-sm text-muted-foreground">
                    {item.occasion}{item.subtitle ? ` · ${item.subtitle}` : ''}
                    {item.donationType ? ` · ${normalizeDonationType(item.donationType)}` : ''}
                  </div>
                  {item.phone && (
                    <a href={`tel:${item.phone}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />{item.phone}
                    </a>
                  )}
                </div>
                {done && <Badge variant="outline" className="text-success border-success/30 bg-success/10">Done</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => setWish(item)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />Send WhatsApp Wish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!donation || !item.sponsor}
                  title={donation ? undefined : 'No donation recorded for this person yet'}
                  onClick={() => { if (donation && item.sponsor) setThanks({ sponsor: item.sponsor, donation }); }}
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
    ? wish.occasionRecord || (wish.kind === 'birthday'
      ? ({ occasion_type: 'Birthday', person_name: wish.personName, family_member_id: wish.familyMember ? wish.key : null } as SpecialOccasion)
      : null)
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
          onOpenChange={(o) => { if (!o) setWish(null); }}
          onSent={onChanged}
        />
      )}
      {thanks && (
        <ThankYouDialog
          sponsor={thanks.sponsor}
          donation={thanks.donation}
          onOpenChange={(o) => { if (!o) setThanks(null); }}
          onSent={onChanged}
        />
      )}
    </Card>
  );
}
