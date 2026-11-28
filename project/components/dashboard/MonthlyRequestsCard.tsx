'use client';

import Link from 'next/link';
import { Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { monthName } from '@/lib/monthly-request';
import { useMonthlyRequestCounts } from '@/lib/monthly-requests-store';

/** Dashboard, 1st–3rd of the month only: this month's sponsorship requests to send. */
export function MonthlyRequestsCard() {
  const { month, counts } = useMonthlyRequestCounts();
  if (!counts) return null;
  return (
    <Card className="p-4 border-2 border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Send className="h-5 w-5" /></div>
      <div className="flex-1">
        <div className="font-semibold">Monthly Sponsorship Requests – {monthName(month, 'en')}</div>
        <div className="text-sm text-muted-foreground">Pending: {counts.pending} · Sent: {counts.sent} · மாதாந்திர நன்கொடை கோரிக்கை (1st–3rd)</div>
      </div>
      <Link href="/monthly-sponsors/requests"><Button>{counts.pending ? 'Send requests' : 'View requests'}</Button></Link>
    </Card>
  );
}
