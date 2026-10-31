'use client';

import { Button } from '@/components/ui/button';
import { formatSentAt, thanksStatus } from '@/lib/messaging';
import type { Donation, MessageLog } from '@/lib/types';

/** On a donation: "💚 Send Thanks", or "✓ Thanks Sent · time by employee" with Resend. */
export function ThanksStatusButton({ donation, logs, onSend }: { donation: Donation; logs: MessageLog[]; onSend: () => void }) {
  const status = thanksStatus(donation, logs);
  if (!status.sent) {
    return (
      <div className="text-right">
        <Button variant="outline" size="sm" className="text-green-700 border-green-200 hover:bg-green-50 whitespace-nowrap" onClick={onSend}>
          💚 Send Thanks
        </Button>
        {status.awaitingConfirm && <div className="text-xs text-muted-foreground mt-1">WhatsApp opened, not confirmed</div>}
      </div>
    );
  }
  return (
    <div className="text-xs text-right">
      <div className="text-success font-medium">
        ✓ Thanks Sent{status.at ? ` · ${formatSentAt(status.at)}` : ''}{status.by ? ` by ${status.by}` : ''}
      </div>
      <button type="button" className="text-primary hover:underline" onClick={onSend}>Resend</button>
    </div>
  );
}
