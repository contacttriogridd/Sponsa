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
import type { OrganizationSettings } from '@/lib/types';

export default function SettingsPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [names, setNames] = useState(organizationNamesFrom(null));
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', state: '', timezone: 'Asia/Kolkata', currency: 'INR' });
  const [intervals, setIntervals] = useState<number[]>([7, 3, 1, 0]);
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
      }
    })();
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function toggleInterval(val: number) {
    setIntervals((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val].sort((a, b) => b - a)
    );
  }

  async function save() {
    setBusy(true); setError('');
    const orgNames = { org_name_en: names.org_name_en.trim(), org_name_ta: names.org_name_ta.trim() };
    // `name` follows the English name so older code reading it stays in step.
    const payload = { ...form, ...orgNames, name: orgNames.org_name_en || form.name, reminder_intervals: intervals };
    const run = (p: Record<string, unknown>) => org
      ? supabase.from('organization_settings').update(p).eq('id', org.id)
      : supabase.from('organization_settings').insert(p);
    const { error: err } = await run(payload);
    let message = err ? err.message || 'Unable to save settings.' : '';
    if (err?.code === 'PGRST204' && err.message.includes('org_name_')) {
      // Migration 00009 hasn't been applied yet: save everything else.
      const { org_name_en: _en, org_name_ta: _ta, ...rest } = payload;
      const { error: retryErr } = await run(rest);
      message = retryErr
        ? retryErr.message || 'Unable to save settings.'
        : 'Other settings saved, but the organization names need database migration 00009 before they can be saved.';
    }
    setBusy(false);
    if (message) { setError(message); return; }
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
