'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Save, MessageCircle, Users, FileText, Settings2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PushNotificationsCard } from '@/components/shared/PushNotificationsCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { REMINDER_INTERVAL_OPTIONS } from '@/lib/constants';
import { organizationNamesFrom } from '@/lib/organization';
import { DEFAULT_STAR_REMINDER_DAYS } from '@/lib/monthly-sponsors';
import { THANK_YOU_TEMPLATE, thankYouTemplateFrom } from '@/lib/thank-you';
import { formatSentAt, messagingSettingsFrom, type MessagingSettings } from '@/lib/messaging';
import { normalizeIndianNumber } from '@/lib/phone';
import { clearWishContext } from '@/lib/star-wish';
import { isWhatsAppConfigured } from '@/lib/whatsapp';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OrganizationSettings } from '@/lib/types';

export default function SettingsPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [names, setNames] = useState(organizationNamesFrom(null));
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', state: '', timezone: 'Asia/Kolkata', currency: 'INR' });
  const [intervals, setIntervals] = useState<number[]>([7, 3, 1, 0]);
  const [starReminderDays, setStarReminderDays] = useState(String(DEFAULT_STAR_REMINDER_DAYS));
  const [thankYou, setThankYou] = useState(THANK_YOU_TEMPLATE);
  const [messaging, setMessaging] = useState<MessagingSettings>(messagingSettingsFrom(null));
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('organization_settings').select('*').limit(1).single();
      if (data) {
        setOrg(data as OrganizationSettings);
        setForm({
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          timezone: data.timezone || 'Asia/Kolkata',
          currency: data.currency || 'INR',
        });
        setIntervals(data.reminder_intervals || [7, 3, 1, 0]);
        setNames(organizationNamesFrom(data));
        setStarReminderDays(String(data.star_reminder_days ?? DEFAULT_STAR_REMINDER_DAYS));
        setThankYou(thankYouTemplateFrom(data));
        setMessaging(messagingSettingsFrom(data));
      }
    })();
  }, []);

  useEffect(() => {
    isWhatsAppConfigured().then(setApiReady);
    supabase.from('message_logs').select('sent_at').eq('message_type', 'admin_daily_summary').neq('status', 'failed')
      .order('sent_at', { ascending: false }).limit(1).then(({ data }) => setLastSummary(data?.[0]?.sent_at || null));
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function toggleInterval(val: number) {
    setIntervals((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val].sort((a, b) => b - a)
    );
  }

  async function save() {
    const adminNumber = normalizeIndianNumber(messaging.adminNumber);
    if (!adminNumber) { setError('Admin WhatsApp Number must be a 10-digit Indian mobile number.'); return; }
    setBusy(true); setError('');
    const orgNames = { org_name_en: names.org_name_en.trim(), org_name_ta: names.org_name_ta.trim() };
    // `name` follows the English name so older code reading it stays in step.
    const starDays = Math.min(15, Math.max(0, Math.round(Number(starReminderDays) || 0)));
    let payload: Record<string, unknown> = {
      ...form, ...orgNames, name: orgNames.org_name_en || form.name, reminder_intervals: intervals, star_reminder_days: starDays,
      // Stored only when changed from the built-in text, so default wording updates still apply.
      thank_you_template: thankYou.trim() && thankYou.trim() !== THANK_YOU_TEMPLATE ? thankYou.trim() : null,
      admin_whatsapp_number: adminNumber,
      admin_name: messaging.adminName.trim() || 'Admin',
      notify_admin_default: messaging.notifyAdminDefault,
      daily_summary_enabled: messaging.dailySummaryEnabled,
      daily_summary_time: messaging.dailySummaryTime,
      whatsapp_send_mode: messaging.sendMode,
    };
    const run = (p: Record<string, unknown>) => org
      ? supabase.from('organization_settings').update(p).eq('id', org.id)
      : supabase.from('organization_settings').insert(p);
    // Columns added by later migrations; if one is missing, save everything else.
    const optional: { columns: string[]; migration: string; what: string }[] = [
      { columns: ['org_name_en', 'org_name_ta'], migration: '00009', what: 'the organization names' },
      { columns: ['star_reminder_days'], migration: '00011', what: 'the star day reminder days' },
      { columns: ['thank_you_template'], migration: '00014', what: 'the thank-you template' },
      { columns: ['admin_whatsapp_number', 'admin_name', 'notify_admin_default', 'daily_summary_enabled', 'daily_summary_time', 'whatsapp_send_mode'], migration: '00016', what: 'the admin settings' },
    ];
    const skipped: string[] = [];
    let { error: err } = await run(payload);
    while (err?.code === 'PGRST204') {
      const missing = optional.find((o) => o.columns.some((c) => err!.message.includes(`'${c}'`)) && !skipped.includes(o.what));
      if (!missing) break;
      payload = Object.fromEntries(Object.entries(payload).filter(([k]) => !missing.columns.includes(k)));
      skipped.push(missing.what);
      ({ error: err } = await run(payload));
    }
    let message = err ? err.message || 'Unable to save settings.' : '';
    if (!err && skipped.length) {
      message = `Other settings saved, but ${skipped.join(' and ')} need database migrations ${optional.filter((o) => skipped.includes(o.what)).map((o) => o.migration).join(' and ')} first.`;
    }
    setBusy(false);
    clearWishContext();
    if (message) { setError(message); return; }
    setMessaging((m) => ({ ...m, adminNumber }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const settingsLinks = [
    { href: '/settings/whatsapp', icon: MessageCircle, label: 'WhatsApp Settings', desc: 'Configure WhatsApp Business API' },
    { href: '/settings/templates', icon: FileText, label: 'Message Templates', desc: 'Manage birthday, anniversary and sponsorship templates' },
    { href: '/settings/users', icon: Users, label: 'User Management', desc: 'Add and manage team members' },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Configuration</p>
          <h1 className="text-2xl font-semibold mt-1">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organization and application preferences.</p>
        </div>

        <PushNotificationsCard />

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Organization Details</h3>
          <p className="text-sm text-muted-foreground">
            Used for {'{{organization_name}}'} in every message template: English on the first line, Tamil on the second.
          </p>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name-en">Organization Name (English)</Label>
              <Input id="org-name-en" value={names.org_name_en} onChange={(e) => setNames((n) => ({ ...n, org_name_en: e.target.value }))} disabled={!isAdmin} placeholder="VP TRUST" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-name-ta">Organization Name (Tamil)</Label>
              <Input id="org-name-ta" lang="ta" value={names.org_name_ta} onChange={(e) => setNames((n) => ({ ...n, org_name_ta: e.target.value }))} disabled={!isAdmin} placeholder="வள்ளலார் பசியாற்றும் அறக்கட்டளை" />
            </div>
            {!isAdmin && <p className="text-xs text-muted-foreground">Only an admin can change the organization names.</p>}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Organization</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="org@email.com" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} placeholder="Full address" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="Asia/Kolkata" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => set('currency', e.target.value)} placeholder="INR" />
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Reminder Intervals</h3>
          <p className="text-sm text-muted-foreground">Choose when reminders are generated before each occasion.</p>
          <div className="space-y-3">
            {REMINDER_INTERVAL_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-3">
                <Checkbox
                  id={`interval-${opt.value}`}
                  checked={intervals.includes(opt.value)}
                  onCheckedChange={() => toggleInterval(opt.value)}
                />
                <Label htmlFor={`interval-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Star Day Reminders</h3>
          <p className="text-sm text-muted-foreground">
            Monthly sponsors&apos; star days (நட்சத்திர நாள்) and payment days are reminded this many days before, and on the day.
          </p>
          <div className="space-y-1.5 max-w-[12rem]">
            <Label htmlFor="star-reminder-days">Days before</Label>
            <Input id="star-reminder-days" type="number" min="0" max="15" inputMode="numeric" value={starReminderDays} onChange={(e) => setStarReminderDays(e.target.value)} />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Admin WhatsApp</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-number">Admin WhatsApp Number</Label>
              <Input id="admin-number" inputMode="tel" value={messaging.adminNumber} onChange={(e) => setMessaging((m) => ({ ...m, adminNumber: e.target.value }))} disabled={!isAdmin} placeholder="919629522777" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-name">Admin Name</Label>
              <Input id="admin-name" value={messaging.adminName} onChange={(e) => setMessaging((m) => ({ ...m, adminName: e.target.value }))} disabled={!isAdmin} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="notify-default" checked={messaging.notifyAdminDefault} onCheckedChange={(v) => setMessaging((m) => ({ ...m, notifyAdminDefault: v }))} disabled={!isAdmin} />
              <Label htmlFor="notify-default" className="cursor-pointer">Notify admin by default</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="daily-summary" checked={messaging.dailySummaryEnabled} onCheckedChange={(v) => setMessaging((m) => ({ ...m, dailySummaryEnabled: v }))} disabled={!isAdmin} />
              <Label htmlFor="daily-summary" className="cursor-pointer">Daily summary to admin</Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary-time">Summary time (IST)</Label>
              <Input id="summary-time" type="time" value={messaging.dailySummaryTime} onChange={(e) => setMessaging((m) => ({ ...m, dailySummaryTime: e.target.value }))} disabled={!isAdmin} />
              <p className="text-xs text-muted-foreground">Sets when the dashboard reminder appears. Automatic sending runs at 8:00 AM.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>WhatsApp sending mode</Label>
              <Select value={messaging.sendMode} onValueChange={(v) => setMessaging((m) => ({ ...m, sendMode: v as MessagingSettings['sendMode'] }))} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (WhatsApp link)</SelectItem>
                  <SelectItem value="automatic">Automatic (WhatsApp API)</SelectItem>
                </SelectContent>
              </Select>
              {messaging.sendMode === 'automatic' && !apiReady && (
                <p className="text-xs text-destructive">The WhatsApp API isn&apos;t set up on the server, so Automatic sends will fail.</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Last summary sent: {lastSummary ? formatSentAt(lastSummary) : 'never'}</p>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Thank You Message Template</h3>
          <p className="text-sm text-muted-foreground">
            Sent after a donation. Placeholders: {'{{donor_name}}'}, {'{{donation_type}}'}, {'{{donation_date}}'}, {'{{donation_purpose_ta}}'}, {'{{organization_name}}'}, {'{{organization_name_ta}}'}.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="thank-you-template">Message</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!isAdmin} onClick={() => setThankYou(THANK_YOU_TEMPLATE)}>Reset to default</Button>
            </div>
            <Textarea id="thank-you-template" value={thankYou} onChange={(e) => setThankYou(e.target.value)} rows={16} disabled={!isAdmin} />
          </div>
          {!isAdmin && <p className="text-xs text-muted-foreground">Only an admin can change the thank-you template.</p>}
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={save} disabled={busy} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </Button>

        <div className="space-y-3">
          <h3 className="font-semibold">More Settings</h3>
          {settingsLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{link.label}</div>
                    <div className="text-sm text-muted-foreground">{link.desc}</div>
                  </div>
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
