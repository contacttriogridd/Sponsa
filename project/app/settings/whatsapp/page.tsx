'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/client';
import { isWhatsAppConfigured } from '@/lib/whatsapp';
import type { OrganizationSettings } from '@/lib/types';

export default function WhatsAppSettingsPage() {
  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('organization_settings').select('*').limit(1).single();
      if (data) {
        setOrg(data as OrganizationSettings);
        setEnabled(data.whatsapp_enabled || false);
      }
      setConfigured(await isWhatsAppConfigured());
    })();
  }, []);

  async function save() {
    if (!org) return;
    setBusy(true);
    await supabase.from('organization_settings').update({ whatsapp_enabled: enabled }).eq('id', org.id);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>

        <div>
          <p className="text-sm text-muted-foreground">Settings</p>
          <h1 className="text-2xl font-semibold mt-1">WhatsApp Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure the WhatsApp Business Cloud API for automated messaging.</p>
        </div>

        <Card className={`p-4 flex items-center gap-3 ${configured ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'}`}>
          {configured
            ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            : <AlertCircle className="h-5 w-5 text-warning shrink-0" />
          }
          <div>
            <div className="font-medium text-sm">
              {configured === null ? 'Checking configuration...' : configured ? 'WhatsApp API configured' : 'WhatsApp API not configured'}
            </div>
            <div className="text-xs text-muted-foreground">
              {configured
                ? 'Messages will be sent via the WhatsApp Business API when enabled below.'
                : 'Messages will be saved as drafts until server credentials are added.'}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Switch id="wa_enabled" checked={enabled} onCheckedChange={setEnabled} />
            <div>
              <Label htmlFor="wa_enabled" className="cursor-pointer font-medium">Enable Automatic WhatsApp Messages</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, birthday and anniversary wishes are sent automatically to consenting sponsors on the day.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold text-sm">Server Environment Variables</h3>
          <p className="text-sm text-muted-foreground">
            For security, WhatsApp credentials are never stored in the database or sent to the browser.
            Set these in your deployment environment (not prefixed with NEXT_PUBLIC_):
          </p>
          <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
            <div>WHATSAPP_ACCESS_TOKEN=...</div>
            <div>WHATSAPP_PHONE_NUMBER_ID=...</div>
            <div>WHATSAPP_BUSINESS_ACCOUNT_ID=...</div>
            <div>WHATSAPP_VERIFY_TOKEN=...</div>
          </div>
          <p className="text-xs text-muted-foreground">From Meta Business Suite → WhatsApp → API Setup. The verify token is used to authenticate webhook callbacks from Meta.</p>
        </Card>

        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </AppLayout>
  );
}
