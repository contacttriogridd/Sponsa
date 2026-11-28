'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MonthlyRequestPreview, RequestComposer, sentLine } from '@/components/monthly/MonthlyRequestPreview';
import { amountLabel } from '@/lib/amount';
import { displayPhone } from '@/lib/phone';
import { formatSentAt } from '@/lib/messaging';
import { monthName } from '@/lib/monthly-request';
import { shiftMonth, todayIst } from '@/lib/monthly-sponsors';
import { REQUEST_STATE_LABELS, inRequestWindow, invalidPhoneRows, monthStart, requestCounts, sendAllQueue, type RequestStatus } from '@/lib/monthly-requests';
import { loadMonthRequests, loadRequestContext, type RequestContext, type RequestSponsor } from '@/lib/monthly-requests-store';
import { openMonthlySponsorDrawer, useDrawerDataChanged } from '@/lib/drawer-store';
import { cn } from '@/lib/utils';

const stateClass: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  opened: 'bg-warning/15 text-warning-foreground',
  sent: 'bg-success/15 text-success',
  donated: 'bg-primary/10 text-primary',
};

/** Monthly Sponsors → Requests: this month's sponsorship request for every active monthly sponsor. */
export default function MonthlyRequestsPage() {
  const today = todayIst();
  const [month, setMonth] = useState(monthStart(today));
  const [rows, setRows] = useState<RequestStatus<RequestSponsor>[] | null>(null);
  const [ready, setReady] = useState(true);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<RequestStatus<RequestSponsor> | null>(null);
  const [queue, setQueue] = useState<RequestStatus<RequestSponsor>[] | null>(null);
  const [position, setPosition] = useState(0);
  const [ctx, setCtx] = useState<RequestContext | null>(null);

  const load = useCallback(() => { loadMonthRequests(month).then(({ rows: r, ready: ok }) => { setRows(r); setReady(ok); }); }, [month]);
  useEffect(() => { setRows(null); load(); }, [load]);
  useDrawerDataChanged(load);
  useEffect(() => { loadRequestContext().then(setCtx); }, []);

  const counts = requestCounts(rows || []);
  const shown = (rows || []).filter((r) => !query || r.sponsor.name.toLowerCase().includes(query.toLowerCase()) || (r.phone || '').includes(query));
  const skipped = invalidPhoneRows(rows || []);
  const isCurrent = month === monthStart(today);

  function startSendAll() {
    const q = sendAllQueue(rows || []);
    setQueue(q); setPosition(0);
  }
  const step = queue && position < queue.length ? queue[position] : null;

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link href="/monthly-sponsors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Monthly Sponsors
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">மாதாந்திர நன்கொடை கோரிக்கை</p>
            <h1 className="text-2xl font-semibold mt-1">Monthly Sponsorship Requests – {monthName(month, 'en')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sent on the 1st–3rd of every month{isCurrent && inRequestWindow(today) ? ' — the sending window is open now' : ''}. Late sending is always possible here.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(monthStart(today))}>This month</Button>
            <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {!ready && <p className="text-sm text-warning bg-warning/10 rounded-lg px-3 py-2">Monthly requests need database migration 00031. Run it in the Supabase SQL Editor, then reload.</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Pending', counts.pending, 'text-warning'], ['Sent', counts.sent, 'text-success'], ['Already donated', counts.donated, 'text-primary'], ['Active sponsors', counts.total, '']].map(([label, n, cls]) => (
            <Card key={label as string} className="p-4 text-center"><div className={cn('text-xl font-bold', cls as string)}>{n as number}</div><div className="text-xs text-muted-foreground mt-1">{label}</div></Card>
          ))}
        </div>

        <Card className="p-3 flex flex-col md:flex-row gap-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone…" className="flex-1" />
          <Button onClick={startSendAll} disabled={!ctx || !sendAllQueue(rows || []).length} className="bg-green-600 hover:bg-green-700 text-white">
            <Send className="h-4 w-4 mr-1.5" />Send All ({sendAllQueue(rows || []).length})
          </Button>
        </Card>

        {skipped.length > 0 && (
          <Card className="p-3 border-destructive/40">
            <div className="text-sm font-medium flex items-center gap-1.5 text-destructive"><AlertTriangle className="h-4 w-4" />Skipped by Send All (invalid number): {skipped.length}</div>
            <ul className="flex flex-wrap gap-2 mt-2">
              {skipped.map((r) => (
                <li key={r.sponsor.id}><Button size="sm" variant="outline" onClick={() => openMonthlySponsorDrawer(r.sponsor.id)}>{r.sponsor.name} — {r.phone || 'no number'} · Edit</Button></li>
              ))}
            </ul>
          </Card>
        )}

        {rows === null ? (
          <div className="py-10 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid gap-2">
            {shown.map((r) => (
              <Card key={r.sponsor.id} className="p-3 sm:p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => openMonthlySponsorDrawer(r.sponsor.id)} className="font-semibold hover:text-primary text-left">{r.sponsor.name}</button>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', stateClass[r.state])}>{r.state === 'sent' ? '✓ Request Sent' : REQUEST_STATE_LABELS[r.state]}</span>
                      {!r.validPhone && <Badge variant="outline" className="text-destructive border-destructive/40">Invalid number</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {r.phone ? displayPhone(r.phone) : 'No phone number'} · {amountLabel(r.sponsor.monthly_amount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sentLine(r.request) || (r.request?.opened_at ? `WhatsApp opened ${formatSentAt(r.request.opened_at)}` : 'Not sent yet')}
                    </div>
                  </div>
                  <Button size="sm" variant={r.state === 'sent' ? 'outline' : 'default'} onClick={() => setSending(r)}>
                    {r.state === 'sent' ? 'Resend' : 'Send Request'}
                  </Button>
                </div>
              </Card>
            ))}
            {shown.length === 0 && <Card className="py-12 text-center text-sm text-muted-foreground">{rows.length ? 'No sponsor matches your search.' : 'No active monthly sponsors.'}</Card>}
          </div>
        )}
      </div>

      <MonthlyRequestPreview row={sending} month={month} open={!!sending} onOpenChange={(o) => !o && setSending(null)} onChanged={load} />

      <Dialog open={!!queue} onOpenChange={(o) => { if (!o) { setQueue(null); load(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send All · {queue && step ? `${position + 1} of ${queue.length}` : 'Done'}</DialogTitle>
          </DialogHeader>
          {queue && step && ctx ? (
            <div className="space-y-3">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(position / queue.length) * 100}%` }} /></div>
              <RequestComposer row={step} month={month} ctx={ctx} stepping onSent={() => setPosition((i) => i + 1)} />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={position === 0} onClick={() => setPosition((i) => i - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
                <Button variant="ghost" size="sm" onClick={() => setPosition((i) => i + 1)}>Skip<ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" />Done — {queue?.length || 0} sponsor{queue?.length === 1 ? '' : 's'} gone through. Skipped (invalid number): {skipped.length}.</p>
              <Button variant="outline" onClick={() => { setQueue(null); load(); }}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
