'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { getTodayIST } from '@/lib/dateHelpers';
import { logMessage, markAdminNotified, sendViaApi } from '@/lib/message-service';
import { buildAdminNotification, messagingSettingsFrom, type MessagingSettings } from '@/lib/messaging';
import { whatsappNumber } from '@/lib/phone';
import { loadWishContext } from '@/lib/star-wish';
import { buildEmailUrl, buildSmsUrl } from '@/lib/thank-you';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { MessageLog, MessageType } from '@/lib/types';

export interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  sponsorId?: string | null;
  sponsorName: string;
  phone: string | null | undefined;
  /** Offers SMS and email as well when given (donation thanks). */
  extraChannels?: { smsPhone?: string | null; email?: string | null };
  messageType: MessageType;
  typeLabel: string;
  /** Filled template; null while it loads. */
  initialText: string | null;
  relatedEventId?: string | null;
  relatedDonationId?: string | null;
  occurrenceDate?: string | null;
  /** The person who receives it, when not the sponsor. */
  contactName?: string | null;
  sendLabel?: string;
  occasionId?: string | null;
  occasionType?: string | null;
  /** e.g. "Arun's Birthday (Son of Ravi Kumar)", for the admin message. */
  occasionTitle?: string | null;
  /** Called after each logged send, with the channel and final text. */
  onLogged?: (channel: MessageLog['channel'], text: string) => void;
  /** Extra controls above the message, e.g. a template picker. */
  children?: React.ReactNode;
}

/** The one Send Message modal: editable message, WhatsApp, and the optional details to the admin. */
export function SendMessageDialog({
  open, onOpenChange, title = 'Send Message', sponsorId, sponsorName, phone, extraChannels, messageType, typeLabel,
  initialText, relatedEventId, relatedDonationId, occurrenceDate, contactName, sendLabel = 'Send on WhatsApp', occasionId, occasionType, occasionTitle, onLogged, children,
}: SendMessageDialogProps) {
  const { appUser } = useAuth();
  const [settings, setSettings] = useState<MessagingSettings>(messagingSettingsFrom(null));
  const [text, setText] = useState('');
  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const [sentLog, setSentLog] = useState<MessageLog | null>(null);
  const [sentText, setSentText] = useState('');
  const [adminDone, setAdminDone] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSentLog(null); setAdminDone(false); setApiError(''); setCopied(false);
    loadWishContext().then((c) => { setSettings(c.messaging); setNotifyAdmin(c.messaging.notifyAdminDefault); });
  }, [open]);

  useEffect(() => { if (initialText != null) setText(initialText); }, [initialText]);

  const employee = appUser?.full_name || appUser?.email || 'Staff';
  const by = { id: appUser?.id, name: employee };
  const number = whatsappNumber(phone);
  const occurrence = occurrenceDate || getTodayIST();
  const automatic = settings.sendMode === 'automatic';

  const base = {
    sponsorId, sponsorName, sponsorPhone: phone, messageType, typeLabel,
    relatedEventId, relatedDonationId, occasionId, occasionType, occurrenceDate: occurrence, recipient: 'sponsor' as const, by,
  };

  const adminMessage = () => buildAdminNotification({
    sponsorName, sponsorPhone: phone || null, typeLabel, occurrenceDate: occurrence,
    message: sentText || text, employee, sentAt: new Date(), occasion: occasionTitle, contactName,
  });
  const adminBase = () => ({
    sponsorId, sponsorName, sponsorPhone: phone, messageType: 'admin_notification' as const,
    typeLabel: `Details to admin: ${typeLabel}`, relatedEventId, relatedDonationId, occasionId, occasionType, occurrenceDate: occurrence,
    messageText: adminMessage(), recipient: 'admin' as const, recipientPhone: settings.adminNumber, by,
  });

  async function logged(channel: MessageLog['channel'], status: MessageLog['status'], extra: { errorMessage?: string; providerMessageId?: string } = {}) {
    setSentText(text);
    const log = await logMessage({ ...base, messageText: text, recipientPhone: number, channel, status, ...extra });
    if (status !== 'failed') { setSentLog(log); onLogged?.(channel, text); }
    return log;
  }

  /** Manual mode: runs as the WhatsApp link is followed. */
  function onLinkClick() {
    setApiError('');
    logged('whatsapp_link', 'opened');
  }

  /** Automatic mode: sends sponsor and admin messages with no further clicks. */
  async function sendAutomatic() {
    setApiBusy(true); setApiError('');
    const result = await sendViaApi(number, text);
    if (!result.success) {
      await logged('whatsapp_api', 'failed', { errorMessage: result.error });
      setApiError(result.configured
        ? `Automatic send failed: ${result.error || 'unknown error'}. Use the WhatsApp link below instead.`
        : 'Automatic sending is not set up on the server. Use the WhatsApp link below instead.');
      setApiBusy(false);
      return;
    }
    const log = await logged('whatsapp_api', 'sent', { providerMessageId: result.messageId });
    if (notifyAdmin) {
      const message = adminMessage();
      const admin = await sendViaApi(settings.adminNumber, message);
      await logMessage({ ...adminBase(), messageText: message, channel: 'whatsapp_api', status: admin.success ? 'sent' : 'failed', errorMessage: admin.error, providerMessageId: admin.messageId });
      if (admin.success) { setAdminDone(true); if (log) await markAdminNotified(log.id); }
    }
    setApiBusy(false);
  }

  function onAdminLinkClick() {
    logMessage({ ...adminBase(), channel: 'whatsapp_link', status: 'opened' });
    if (sentLog) markAdminNotified(sentLog.id);
    setAdminDone(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    logged('copy', 'sent');
  }

  const smsPhone = extraChannels?.smsPhone;
  const email = extraChannels?.email?.trim();
  const whatsappLink = (
    <a href={buildWhatsAppUrl(number, text)} target="_blank" rel="noreferrer" onClick={onLinkClick}>
      <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={initialText == null}>
        <MessageCircle className="h-4 w-4 mr-2" />{sendLabel}
      </Button>
    </a>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        // Keep it open behind the "Did you send?" prompt, and until the admin step is done.
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted text-sm">
            <div className="font-medium">{sponsorName}</div>
            {occasionTitle && <div>{occasionTitle}</div>}
            {contactName && contactName !== sponsorName && <div className="text-muted-foreground">Contact: {contactName}</div>}
            <div className="text-muted-foreground">{number ? `+${number}` : 'No phone number saved — WhatsApp will ask you to choose the chat.'}</div>
            <div className="text-muted-foreground">{typeLabel}</div>
          </div>

          {children}

          <div className="space-y-1.5">
            <Label htmlFor="send-message-text">Message</Label>
            {initialText == null ? (
              <div className="h-64 rounded-md bg-muted animate-pulse" />
            ) : (
              <Textarea id="send-message-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="text-sm leading-relaxed" />
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="notify-admin" checked={notifyAdmin} onCheckedChange={(v) => setNotifyAdmin(v === true)} className="mt-0.5" />
            <Label htmlFor="notify-admin" className="cursor-pointer font-normal">
              Also send sponsor details to Admin ({settings.adminName} – {settings.adminNumber.replace(/^91/, '')})
            </Label>
          </div>

          {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{apiError}</p>}

          <div className="flex flex-wrap gap-2">
            {automatic && !apiError ? (
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={initialText == null || apiBusy} onClick={sendAutomatic}>
                <MessageCircle className="h-4 w-4 mr-2" />{apiBusy ? 'Sending...' : sendLabel}
              </Button>
            ) : whatsappLink}
            {extraChannels && (
              <>
                <span title={smsPhone ? undefined : 'No phone number saved for this sponsor'}>
                  {smsPhone ? (
                    <a href={buildSmsUrl(smsPhone, text)} onClick={() => logged('sms', 'sent')}>
                      <Button variant="outline"><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>
                    </a>
                  ) : <Button variant="outline" disabled><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>}
                </span>
                <span title={email ? undefined : 'No email address saved for this sponsor'}>
                  {email ? (
                    <a href={buildEmailUrl(email, text)} onClick={() => logged('email', 'sent')}>
                      <Button variant="outline"><Mail className="h-4 w-4 mr-1.5" />Email</Button>
                    </a>
                  ) : <Button variant="outline" disabled><Mail className="h-4 w-4 mr-1.5" />Email</Button>}
                </span>
              </>
            )}
            <Button variant="outline" onClick={copy} disabled={initialText == null}>
              <Copy className="h-4 w-4 mr-1.5" />{copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{sentLog ? 'Done' : 'Skip'}</Button>
          </div>

          {sentLog && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-1.5 text-success font-medium"><CheckCircle2 className="h-4 w-4" />Sponsor message done</div>
              {notifyAdmin && !adminDone && !automatic && (
                <a href={buildWhatsAppUrl(settings.adminNumber, adminMessage())} target="_blank" rel="noreferrer" onClick={onAdminLinkClick}>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    <MessageCircle className="h-4 w-4 mr-1.5" />Send details to Admin
                  </Button>
                </a>
              )}
              {adminDone && <div className="text-muted-foreground">Details sent to {settings.adminName}.</div>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
