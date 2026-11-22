'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { getTodayIST } from '@/lib/dateHelpers';
import { logMessage, markAdminNotified, sendViaApi } from '@/lib/message-service';
import { buildAdminNotification, messagingSettingsFrom, type MessagingSettings } from '@/lib/messaging';
import { INVALID_PHONE_MESSAGE, displayPhone, phoneProblem, whatsappNumber } from '@/lib/phone';
import { PhoneLink, warnInvalidPhone } from '@/components/shared/PhoneLink';
import { loadWishContext } from '@/lib/star-wish';
import { buildEmailUrl, buildSmsUrl, unfilledPlaceholders } from '@/lib/thank-you';
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
  /** Extra controls above the message, e.g. a template picker; as a function, told whether the text was edited. */
  children?: React.ReactNode | ((state: { edited: boolean }) => React.ReactNode);
  /** Why the message can't be sent yet (shown as a warning; sending is disabled). Gets the current text. */
  blockReason?: (text: string) => string | null;
  /** Where to fix the contact's number when it is missing or invalid; defaults to the sponsor's page. */
  editContactHref?: string | null;
  onEditContact?: (() => void) | null;
}

/** The one Send Message modal: editable message, WhatsApp, and the optional details to the admin. */
export function SendMessageDialog({
  open, onOpenChange, title = 'Send Message', sponsorId, sponsorName, phone, extraChannels, messageType, typeLabel,
  initialText, relatedEventId, relatedDonationId, occurrenceDate, contactName, sendLabel = 'Send on WhatsApp', occasionId, occasionType, occasionTitle, onLogged, children, blockReason, editContactHref, onEditContact,
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
  // Checked again at send time: an invalid number never opens WhatsApp (no "Send to…" picker).
  const number = whatsappNumber(phone);
  const problem = phoneProblem(phone);
  const editContact = { editHref: editContactHref ?? (sponsorId ? `/sponsors/${sponsorId}` : null), onEdit: onEditContact ?? null };
  const occurrence = occurrenceDate || getTodayIST();
  const automatic = settings.sendMode === 'automatic';
  // A raw {{placeholder}} must never reach the sponsor.
  const leftover = unfilledPlaceholders(text);
  const blocked = initialText == null ? null
    : blockReason?.(text) || (leftover.length ? `The message still has ${leftover.join(', ')}. Replace it before sending.` : null);
  const cannotSend = initialText == null || !!blocked;

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
    if (!number) { warnInvalidPhone(editContact); setApiBusy(false); return; }
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
  const whatsappLink = cannotSend ? (
    <Button className="bg-green-600 hover:bg-green-700 text-white" disabled>
      <MessageCircle className="h-4 w-4 mr-2" />{sendLabel}
    </Button>
  ) : (
    <PhoneLink href={buildWhatsAppUrl(number, text)} newTab onClick={onLinkClick} {...editContact}>
      <Button className="bg-green-600 hover:bg-green-700 text-white">
        <MessageCircle className="h-4 w-4 mr-2" />{sendLabel}
      </Button>
    </PhoneLink>
  );
  const adminLink = buildWhatsAppUrl(settings.adminNumber, sentLog ? adminMessage() : '');

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
            <div className="text-muted-foreground">{number ? displayPhone(phone) : problem === 'missing' ? 'No phone number saved.' : `${displayPhone(phone)} — invalid`}</div>
            <div className="text-muted-foreground">{typeLabel}</div>
          </div>

          {typeof children === 'function' ? children({ edited: initialText != null && text !== initialText }) : children}

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
              Also send sponsor details to Admin ({settings.adminName} – {displayPhone(settings.adminNumber)})
            </Label>
          </div>

          {problem && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{problem === 'missing' ? "This contact has no phone number. Please add one." : INVALID_PHONE_MESSAGE} You can still copy the message.</span>
              {(editContact.editHref || editContact.onEdit) && (
                editContact.onEdit
                  ? <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); editContact.onEdit!(); }}>Edit contact</Button>
                  : <a href={editContact.editHref!}><Button size="sm" variant="outline">Edit contact</Button></a>
              )}
            </div>
          )}

          {blocked && (
            <p className="text-sm text-warning bg-warning/10 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{blocked}
            </p>
          )}

          {apiError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{apiError}</p>}

          <div className="flex flex-wrap gap-2">
            {automatic && !apiError ? (
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={cannotSend || apiBusy || !number} onClick={sendAutomatic}>
                <MessageCircle className="h-4 w-4 mr-2" />{apiBusy ? 'Sending...' : sendLabel}
              </Button>
            ) : whatsappLink}
            {extraChannels && (
              <>
                <span title={smsPhone ? undefined : 'No phone number saved for this sponsor'}>
                  {smsPhone && !cannotSend ? (
                    <PhoneLink href={buildSmsUrl(smsPhone, text)} onClick={() => logged('sms', 'sent')} {...editContact}>
                      <Button variant="outline"><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>
                    </PhoneLink>
                  ) : <Button variant="outline" disabled><MessageSquare className="h-4 w-4 mr-1.5" />SMS</Button>}
                </span>
                <span title={email ? undefined : 'No email address saved for this sponsor'}>
                  {email && !cannotSend ? (
                    <a href={buildEmailUrl(email, text)} onClick={() => logged('email', 'sent')}>
                      <Button variant="outline"><Mail className="h-4 w-4 mr-1.5" />Email</Button>
                    </a>
                  ) : <Button variant="outline" disabled><Mail className="h-4 w-4 mr-1.5" />Email</Button>}
                </span>
              </>
            )}
            <Button variant="outline" onClick={copy} disabled={cannotSend}>
              <Copy className="h-4 w-4 mr-1.5" />{copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>{sentLog ? 'Done' : 'Skip'}</Button>
          </div>

          {sentLog && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-1.5 text-success font-medium"><CheckCircle2 className="h-4 w-4" />Sponsor message done</div>
              {notifyAdmin && !adminDone && !automatic && (
                <PhoneLink href={adminLink} newTab onClick={onAdminLinkClick} editHref="/settings">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                    <MessageCircle className="h-4 w-4 mr-1.5" />Send details to Admin
                  </Button>
                </PhoneLink>
              )}
              {adminDone && <div className="text-muted-foreground">Details sent to {settings.adminName}.</div>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
