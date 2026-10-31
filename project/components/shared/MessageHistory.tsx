'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHANNEL_LABELS, MESSAGE_TYPE_LABELS, formatDateLabel, formatSentAt } from '@/lib/messaging';
import type { MessageLog } from '@/lib/types';

/** Sponsor profile: every wish and thank-you sent to this sponsor, newest first. */
export function MessageHistory({ logs }: { logs: MessageLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toSponsor = logs.filter((l) => l.recipient === 'sponsor' && l.status !== 'failed');
  const confirmed = toSponsor.filter((l) => l.status !== 'opened');
  const thanks = confirmed.filter((l) => l.message_type === 'donation_thanks').length;

  return (
    <div className="space-y-3">
      <Card className="p-3 text-sm">
        Wishes sent: <span className="font-semibold">{confirmed.length - thanks}</span>
        {' · '}Thanks sent: <span className="font-semibold">{thanks}</span>
        {' · '}Last message: <span className="font-semibold">{toSponsor[0] ? formatSentAt(toSponsor[0].sent_at) : '—'}</span>
      </Card>
      {toSponsor.map((l) => (
        <Card key={l.id} className="p-4">
          <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{l.type_label || MESSAGE_TYPE_LABELS[l.message_type]}</span>
              <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[l.channel]}</Badge>
              {l.status === 'opened' && <Badge variant="outline" className="text-xs text-warning border-warning/40">Not confirmed</Badge>}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {formatSentAt(l.sent_at)}{l.sent_by_name ? ` by ${l.sent_by_name}` : ''} · for {formatDateLabel(l.occurrence_date)}
            </div>
          </button>
          {expanded === l.id && <p className="text-sm whitespace-pre-line mt-3 pt-3 border-t border-border">{l.message_text}</p>}
        </Card>
      ))}
      {toSponsor.length === 0 && <Card className="py-10 text-center text-sm text-muted-foreground">No messages sent yet.</Card>}
    </div>
  );
}
