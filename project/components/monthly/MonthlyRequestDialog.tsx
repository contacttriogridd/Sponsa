'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, MessageSquare, Send } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import { messagingSettingsFrom, type SendMode } from '@/lib/messaging';
import { DEFAULT_REQUEST_EN, DEFAULT_REQUEST_TA, buildRequestMessage, requestDueDate, type PaymentDetails, type RequestLanguage } from '@/lib/monthly-request';
import { whatsappNumber } from '@/lib/phone';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { buildSmsUrl } from '@/lib/thank-you';
import { logMessage, sendViaApi } from '@/lib/message-service';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import { formatCurrency } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { MonthlySponsor } from '@/lib/types';
import { openMonthlySponsorDrawer } from '@/lib/drawer-store';

type Row = MonthlySponsor & { sponsors?: { whatsapp?: string | null; phone?: string | null } | null };

interface Ctx { templates: { ta: string; en: string }; org: OrganizationNames; pay: PaymentDetails; sendMode: SendMode }

const LANGS: [RequestLanguage, string][] = [['ta', 'தமிழ்'], ['en', 'English'], ['both', 'Both']];
const phoneOf = (s: Row) => s.phone || s.sponsors?.whatsapp || s.sponsors?.phone || null;

/**
 * Monthly Sponsorship Request to one sponsor or, in bulk, to everyone who has
 * not paid for the month: one by one in WhatsApp (or SMS), or all at once in
 * automatic mode. Each send is logged, which also creates the Sponsorship
 * record (status Requested) for that sponsor and month.
 */
export function MonthlyRequestDialog({ open, onOpenChange, sponsors, month }: { open: boolean; onOpenChange: (o: boolean) => void; sponsors: Row[]; month: string }) {
  const { appUser } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [lang, setLang] = useState<RequestLanguage>('ta');
  const [index, setIndex] = useState(0);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIndex(0); setEdited({}); setResult(null);
    (async () => {
      const [{ data: rows }, { data: org }, { data: reqs }] = await Promise.all([
        supabase.from('message_templates').select('language, body, is_approved').eq('type', 'Monthly Sponsorship Request').order('is_approved', { ascending: false }),
        supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
        supabase.from('sponsorship_requests').select('monthly_sponsor_id, special_date, request_sent_at').not('monthly_sponsor_id', 'is', null)
          .gte('special_date', month).lte('special_date', `${month.slice(0, 8)}31`),
      ]);
      const pick = (l: 'ta' | 'en') => (rows || []).find((r) => r.language === l)?.body as string | undefined;
      setCtx({
        templates: { ta: pick('ta') || DEFAULT_REQUEST_TA, en: pick('en') || DEFAULT_REQUEST_EN },
        org: organizationNamesFrom(org),
        pay: { upi_id: org?.upi_id || '', bank_details: org?.bank_details || '', contact_number: org?.phone || '' },
        sendMode: messagingSettingsFrom(org).sendMode,
      });
      setSent(new Set((reqs || []).filter((r) => r.request_sent_at).map((r) => r.monthly_sponsor_id as string)));
    })();
  }, [open, month]);

  const reachable = useMemo(() => sponsors.filter((s) => whatsappNumber(phoneOf(s))), [sponsors]);
  const noPhone = sponsors.length - reachable.length;
  const current = reachable[index];
  const messageFor = (s: Row) => edited[`${s.id}|${lang}`] ?? (ctx ? buildRequestMessage(ctx.templates, s, month, lang, ctx.org, ctx.pay) : '');
  const message = current ? messageFor(current) : '';
  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  async function log(s: Row, text: string, channel: 'whatsapp_link' | 'whatsapp_api' | 'sms', status: 'opened' | 'sent' | 'failed', error?: string) {
    await logMessage({
      sponsorId: s.sponsor_id, sponsorName: s.name, sponsorPhone: phoneOf(s), monthlySponsorId: s.id, sponsorCategory: 'monthly',
      messageType: 'sponsorship_request', typeLabel: `Monthly Sponsorship Request – ${monthLabel}`, relatedEventId: `mspay:${s.id}`,
      occurrenceDate: requestDueDate(s, month), messageText: text, recipient: 'sponsor', recipientPhone: whatsappNumber(phoneOf(s)),
      channel, status, errorMessage: error || null, language: lang === 'both' ? 'both' : lang,
      by: { id: appUser?.id, name: appUser?.full_name || appUser?.email },
    });
    if (status !== 'failed') setSent((x) => new Set([...Array.from(x), s.id]));
  }

  const next = () => setIndex((i) => Math.min(i + 1, reachable.length));

  async function sendAllAutomatically() {
    if (!ctx) return;
    setBusy(true);
    let ok = 0; let failed = 0;
    for (const s of reachable) {
      if (sent.has(s.id)) continue;
      const text = messageFor(s);
      const r = await sendViaApi(whatsappNumber(phoneOf(s))!, text);
      await log(s, text, 'whatsapp_api', r.success ? 'sent' : 'failed', r.error);
      if (r.success) ok++; else failed++;
    }
    setBusy(false);
    notifyDrawerDataChanged();
    setResult(`${ok} sent${failed ? `, ${failed} failed` : ''}.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Sponsorship Request · {monthLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Language">
              {LANGS.map(([l, label]) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
                  className={cn('px-3 py-1 text-sm rounded-md', lang === l ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{label}</button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{sent.size ? `${reachable.filter((s) => sent.has(s.id)).length} of ${reachable.length} requested` : `${reachable.length} sponsor${reachable.length === 1 ? '' : 's'}`}</span>
          </div>
          {ctx && !ctx.pay.upi_id && (
            <p className="text-xs flex gap-1.5 rounded-md bg-warning/10 p-2"><AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />No UPI ID saved yet — add it in <Link href="/settings" className="text-primary underline">Settings</Link>.</p>
          )}
          {noPhone > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Skipped (invalid number): {noPhone}</p>
              <ul className="flex flex-wrap gap-1">
                {sponsors.filter((s) => !whatsappNumber(phoneOf(s))).map((s) => (
                  <li key={s.id}><button type="button" className="underline hover:text-foreground" onClick={() => { onOpenChange(false); openMonthlySponsorDrawer(s.id); }}>{s.name} — Edit</button></li>
                ))}
              </ul>
            </div>
          )}

          {result ? (
            <div className="rounded-md border p-3 text-sm">{result}</div>
          ) : current ? (
            <>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                {reachable.length > 1 && <Badge variant="outline">{index + 1} of {reachable.length}</Badge>}
                <span className="font-medium">{current.name}</span>
                <span className="text-muted-foreground">{current.monthly_amount != null ? formatCurrency(Number(current.monthly_amount)) : ''} · due {requestDueDate(current, month).slice(8)}</span>
                {sent.has(current.id) && <Badge variant="outline" className="text-success border-success/40"><CheckCircle2 className="h-3 w-3 mr-1" />Requested</Badge>}
              </div>
              <Textarea rows={8} value={message} onChange={(e) => setEdited((x) => ({ ...x, [`${current.id}|${lang}`]: e.target.value }))} className="text-sm" lang={lang === 'en' ? 'en' : 'ta'} />
              <div className="flex flex-wrap gap-2">
                <a href={buildWhatsAppUrl(phoneOf(current), message) || undefined} target="_blank" rel="noreferrer"
                  onClick={() => { log(current, message, 'whatsapp_link', 'opened'); next(); }}>
                  <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!ctx}><MessageCircle className="h-4 w-4 mr-1.5" />{reachable.length > 1 ? 'Open WhatsApp & next' : 'Open WhatsApp'}</Button>
                </a>
                <a href={buildSmsUrl(phoneOf(current), message) || undefined} onClick={() => log(current, message, 'sms', 'opened')}>
                  <Button variant="outline" disabled={!ctx}><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>
                </a>
                {reachable.length > 1 && (
                  <>
                    <Button variant="outline" onClick={next}>Skip<ChevronRight className="h-4 w-4 ml-1" /></Button>
                    <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
                  </>
                )}
              </div>
              {ctx?.sendMode === 'automatic' && reachable.length > 1 && (
                <Button variant="secondary" disabled={busy} onClick={sendAllAutomatically}>
                  <Send className="h-4 w-4 mr-1.5" />{busy ? 'Sending…' : `Send to all ${reachable.filter((s) => !sent.has(s.id)).length} automatically`}
                </Button>
              )}
            </>
          ) : (
            <div className="rounded-md border p-3 text-sm">{reachable.length ? `Sent: ${reachable.filter((s) => sent.has(s.id)).length} · Skipped (invalid number): ${noPhone}` : 'No sponsor with a valid number to send to.'}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
