'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, MessageCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PhoneLink } from '@/components/shared/PhoneLink';
import { useAuth } from '@/lib/auth-context';
import { amountLabel } from '@/lib/amount';
import { buildSmsLink, buildWhatsAppLink, displayPhone, INVALID_PHONE_MESSAGE } from '@/lib/phone';
import { formatSentAt } from '@/lib/messaging';
import { openMonthlySponsorDrawer } from '@/lib/drawer-store';
import { buildRequestMessage, monthName, type RequestLanguage } from '@/lib/monthly-request';
import { REQUEST_STATE_LABELS, type RequestStatus } from '@/lib/monthly-requests';
import { loadRequestContext, markRequestOpened, markRequestSent, type RequestContext, type RequestSponsor } from '@/lib/monthly-requests-store';
import { cn } from '@/lib/utils';

const LANGS: [RequestLanguage, string][] = [['en', 'English'], ['ta', 'தமிழ்'], ['both', 'Both']];

export function sentLine(r: RequestStatus['request']): string | null {
  if (r?.status !== 'sent' || !r.sent_at) return null;
  return `✓ Request Sent · ${formatSentAt(r.sent_at)}${r.sent_by_name ? ` by ${r.sent_by_name}` : ''}`;
}

interface ComposerProps {
  row: RequestStatus<RequestSponsor>;
  month: string;
  ctx: RequestContext;
  /** After "Mark sent" (Send All moves to the next sponsor). */
  onSent?: () => void;
  /** Send All: Open WhatsApp marks it sent and moves on. */
  stepping?: boolean;
}

/** The message, language toggle and send buttons for one sponsor's request. */
export function RequestComposer({ row, month, ctx, onSent, stepping }: ComposerProps) {
  const { appUser } = useAuth();
  const by = { id: appUser?.id, name: appUser?.full_name || appUser?.email };
  const [lang, setLang] = useState<RequestLanguage>(ctx.defaultLanguage);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState(false);
  const [confirmResend, setConfirmResend] = useState(row.state !== 'sent');
  const s = row.sponsor;
  const text = edited[lang] ?? buildRequestMessage(ctx.templates, s, month, lang, ctx.org, ctx.pay);

  useEffect(() => { setOpened(false); setEdited({}); setConfirmResend(row.state !== 'sent'); }, [row.sponsor.id, row.state]);

  async function sent(channel?: string) {
    const err = await markRequestSent(s, month, by, { channel, language: lang, message: text });
    if (err) { toast.error(err); return; }
    toast.success(`${s.name}: request marked as sent`);
    onSent?.();
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); toast.success('Message copied'); } catch { toast.error('Copy failed — select the text and copy it.'); }
    markRequestOpened(s, month, 'copy', lang, text, by);
    setOpened(true);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted p-3 text-sm space-y-0.5">
        <div className="font-medium">{s.name}</div>
        <div className="text-muted-foreground">{row.phone ? displayPhone(row.phone) : 'No phone number'} · {amountLabel(s.monthly_amount)} · {monthName(month, 'en')}</div>
        <div className={row.state === 'sent' ? 'text-success' : 'text-muted-foreground'}>{sentLine(row.request) || REQUEST_STATE_LABELS[row.state]}</div>
      </div>

      {!row.validPhone && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <AlertTriangle className="h-4 w-4 shrink-0" /><span className="flex-1">{INVALID_PHONE_MESSAGE}</span>
          <Button size="sm" variant="outline" onClick={() => openMonthlySponsorDrawer(s.id)}>Edit contact</Button>
        </p>
      )}
      {row.state === 'donated' && <p className="text-sm text-success bg-success/10 rounded-lg px-3 py-2">Already donated this month — a request is not needed.</p>}

      <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Language">
        {LANGS.map(([l, label]) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
            className={cn('px-3 py-1 text-sm rounded-md', lang === l ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{label}</button>
        ))}
      </div>
      <Textarea rows={12} value={text} onChange={(e) => setEdited((x) => ({ ...x, [lang]: e.target.value }))} className="text-sm leading-relaxed" lang={lang === 'en' ? 'en' : 'ta'} />

      {!confirmResend ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm space-y-2">
          <p>This month&apos;s request was already sent to {s.name}. Send it again?</p>
          <Button size="sm" variant="outline" onClick={() => setConfirmResend(true)}><RotateCcw className="h-4 w-4 mr-1.5" />Resend</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <PhoneLink href={buildWhatsAppLink(row.phone, text)} newTab onEdit={() => openMonthlySponsorDrawer(s.id)}
            onClick={() => { markRequestOpened(s, month, 'whatsapp', lang, text, by); setOpened(true); }}>
            <Button className="bg-green-600 hover:bg-green-700 text-white"><MessageCircle className="h-4 w-4 mr-1.5" />Open WhatsApp</Button>
          </PhoneLink>
          <PhoneLink href={buildSmsLink(row.phone, text)} onEdit={() => openMonthlySponsorDrawer(s.id)}
            onClick={() => { markRequestOpened(s, month, 'sms', lang, text, by); setOpened(true); }}>
            <Button variant="outline"><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>
          </PhoneLink>
          <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-1.5" />Copy</Button>
          <Button variant={opened ? 'default' : 'outline'} onClick={() => sent(opened ? undefined : 'manual')}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />{stepping ? 'Mark sent & next' : 'Mark sent'}
          </Button>
        </div>
      )}
      {opened && <p className="text-xs text-muted-foreground">Sent it in WhatsApp? Press <strong>Mark sent</strong> to record it.</p>}
    </div>
  );
}

/** "Send Request" for one sponsor. */
export function MonthlyRequestPreview({ row, month, open, onOpenChange, onChanged }: {
  row: RequestStatus<RequestSponsor> | null; month: string; open: boolean; onOpenChange: (o: boolean) => void; onChanged?: () => void;
}) {
  const [ctx, setCtx] = useState<RequestContext | null>(null);
  useEffect(() => { if (open) loadRequestContext().then(setCtx); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onChanged?.(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Monthly Sponsorship Request · {monthName(month, 'en')}</DialogTitle></DialogHeader>
        {row && ctx ? <RequestComposer row={row} month={month} ctx={ctx} onSent={() => { onOpenChange(false); onChanged?.(); }} /> : <div className="h-64 rounded-md bg-muted animate-pulse" />}
      </DialogContent>
    </Dialog>
  );
}
