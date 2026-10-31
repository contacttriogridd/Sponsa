'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getPendingMessages, resolvePending, subscribePending, type PendingMessage } from '@/lib/message-service';

const SHOW_AFTER_MS = 1500;

/**
 * "Did you send the message?" A wa.me link only opens WhatsApp, so the app asks
 * when the employee comes back. Yes marks the log sent; No removes the entry.
 */
export function MessageConfirmHost() {
  const [current, setCurrent] = useState<PendingMessage | null>(null);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const next = getPendingMessages().find((p) => Date.now() - p.openedAt > SHOW_AFTER_MS) || null;
      setCurrent((prev) => (prev?.id === next?.id ? prev : next));
    };
    check();
    const interval = setInterval(check, 1000);
    const unsubscribe = subscribePending(check);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!current) return null;

  // pointer-events-auto: stays clickable while a dialog is open behind it.
  return (
    <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-md pointer-events-auto rounded-xl border border-border bg-card shadow-xl p-4">
      <p className="text-sm font-medium">Did you send the message?</p>
      <p className="text-sm text-muted-foreground mt-0.5">{current.label}</p>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={() => { setCurrent(null); resolvePending(current.id, true); }}>Yes, sent</Button>
        <Button size="sm" variant="outline" onClick={() => { setCurrent(null); resolvePending(current.id, false); }}>No</Button>
      </div>
    </div>
  );
}
