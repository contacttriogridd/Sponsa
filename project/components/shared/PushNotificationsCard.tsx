'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Send, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  disablePush, enablePush, getPushSupport, isPushEnabled, sendTestPush, type PushSupport,
} from '@/lib/push-client';

export function PushNotificationsCard() {
  const { appUser } = useAuth();
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSupport(getPushSupport());
    isPushEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Smartphone className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Phone notifications</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Get a notification on this device every morning at 8 AM when a sponsor&apos;s birthday or anniversary is coming up — even when the app is closed.
          </p>
        </div>
      </div>

      {support === 'ios-needs-install' && (
        <p className="text-sm rounded-lg bg-muted px-3 py-2">
          On iPhone, first add VP Trust to your Home Screen: in Safari tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open the app from the new icon, then come back here.
        </p>
      )}
      {support === 'unsupported' && (
        <p className="text-sm rounded-lg bg-muted px-3 py-2">This browser does not support notifications. Try Chrome on Android or the installed app.</p>
      )}
      {support === 'not-configured' && (
        <p className="text-sm rounded-lg bg-muted px-3 py-2">Phone notifications are not set up on the server yet.</p>
      )}

      {support === 'supported' && appUser && (
        <div className="flex flex-wrap gap-3">
          {enabled ? (
            <>
              <Button disabled={busy} onClick={() => run(sendTestPush, 'Test sent — check your notifications.')}>
                <Send className="h-4 w-4 mr-2" />Send test notification
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run(async () => { await disablePush(); setEnabled(false); }, 'Notifications turned off for this device.')}
              >
                <BellOff className="h-4 w-4 mr-2" />Turn off
              </Button>
            </>
          ) : (
            <Button
              disabled={busy}
              onClick={() => run(async () => { await enablePush(appUser.id); setEnabled(true); }, 'Notifications are on for this device.')}
            >
              <BellRing className="h-4 w-4 mr-2" />{busy ? 'Turning on...' : 'Turn on notifications'}
            </Button>
          )}
        </div>
      )}

      {message && (
        <p className={`text-sm rounded-lg px-3 py-2 ${message.kind === 'ok' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
