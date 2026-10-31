'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { organizationNamesFrom, DEFAULT_ORGANIZATION_NAMES, type OrganizationNames } from '@/lib/organization';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { whatsappNumber } from '@/lib/star-wish';
import {
  THANK_YOU_CHANNEL_LABELS, buildEmailUrl, buildSmsUrl, donationSummary, fillTemplate, thankYouData, thankYouTemplateFrom,
  type ThankYouChannel,
} from '@/lib/thank-you';
import type { Donation, Sponsor } from '@/lib/types';

interface ThankYouDialogProps {
  sponsor: Sponsor;
  donation: Donation | null;
  onOpenChange: (open: boolean) => void;
  /** Called after a thank-you is sent or copied, with the updated donation. */
  onSent: (donation: Donation, channel: ThankYouChannel) => void;
}

/**
 * "Send Thank You Message" for a donation: the thank-you template filled from
 * the donation record, shown in an editable box, sent by WhatsApp, SMS or
 * email, or copied. Every send marks the donation as thanked, logs a
 * timeline entry and updates the sponsor's last contact date.
 */
export function ThankYouDialog({ sponsor, donation, onOpenChange, onSent }: ThankYouDialogProps) {
  const { appUser } = useAuth();
  const [template, setTemplate] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationNames>(DEFAULT_ORGANIZATION_NAMES);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  // Organization names and saved templates, loaded when the dialog opens.
  useEffect(() => {
    if (!donation) return;
    setCopied(false);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
      if (cancelled) return;
      setOrganization(organizationNamesFrom(data));
      setTemplate(thankYouTemplateFrom(data));
    })();
    return () => { cancelled = true; };
  }, [donation]);

  // Fill the template once its data has loaded.
  useEffect(() => {
    if (!donation || !template) return;
    setText(fillTemplate(template, thankYouData(sponsor, donation, organization)));
  }, [template, organization, sponsor, donation]);

  const phone = sponsor.whatsapp || sponsor.phone;
  const smsPhone = sponsor.phone || sponsor.whatsapp;
  const email = sponsor.email?.trim();

  async function record(channel: ThankYouChannel) {
    if (!donation) return;
    const now = new Date().toISOString();
    const [{ data: updated }] = await Promise.all([
      // Best effort: these columns arrive with migration 00013.
      supabase.from('donations').update({ thank_you_sent: true, thank_you_sent_at: now, thank_you_channel: channel })
        .eq('id', donation.id).select().maybeSingle(),
      supabase.from('interactions').insert({
        sponsor_id: sponsor.id,
        type: channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : 'other',
        summary: channel === 'copy' ? 'Thank-you message copied' : `Thank-you message sent via ${THANK_YOU_CHANNEL_LABELS[channel]}`,
        details: text,
        interaction_date: now,
        conducted_by: appUser?.id || null,
      }),
      supabase.from('sponsors').update({ last_contact_date: now.split('T')[0] }).eq('id', sponsor.id),
    ]);
    onSent((updated as Donation) || { ...donation, thank_you_sent: true, thank_you_sent_at: now, thank_you_channel: channel }, channel);
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
    record('copy');
  }

  /** A send link, or a disabled button with a tooltip saying why. */
  function sendAction(channel: Exclude<ThankYouChannel, 'copy'>, href: string | null, icon: React.ReactNode, missing: string, extra?: string) {
    const label = THANK_YOU_CHANNEL_LABELS[channel];
    if (!href) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}><Button variant="outline" disabled className="pointer-events-none">{icon}{label}</Button></span>
          </TooltipTrigger>
          <TooltipContent>{missing}</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <a
        href={href}
        target={channel === 'whatsapp' ? '_blank' : undefined}
        rel="noreferrer"
        // Close after the browser has followed the link (a removed link doesn't navigate).
        onClick={() => { record(channel); setTimeout(() => onOpenChange(false), 300); }}
      >
        <Button variant="outline" className={extra}>{icon}{label}</Button>
      </a>
    );
  }

  return (
    <Dialog open={!!donation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Thank You Message</DialogTitle>
        </DialogHeader>
        {donation && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted text-sm">
              <div className="font-medium">{sponsor.full_name}</div>
              <div className="text-muted-foreground">{donationSummary(donation)}</div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="thank-you-text">Message</Label>
              {template ? (
                <Textarea id="thank-you-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="text-sm leading-relaxed" />
              ) : (
                <div className="h-72 rounded-md bg-muted animate-pulse" />
              )}
            </div>

            <TooltipProvider delayDuration={100}>
              <div className="flex flex-wrap gap-2">
                {sendAction('whatsapp', phone ? buildWhatsAppUrl(whatsappNumber(phone), text) : null,
                  <MessageCircle className="h-4 w-4 mr-1.5" />, 'No phone number saved for this sponsor', 'text-green-600 border-green-200 hover:bg-green-50')}
                {sendAction('sms', smsPhone ? buildSmsUrl(smsPhone, text) : null,
                  <MessageSquare className="h-4 w-4 mr-1.5" />, 'No phone number saved for this sponsor')}
                {sendAction('email', email ? buildEmailUrl(email, text) : null,
                  <Mail className="h-4 w-4 mr-1.5" />, 'No email address saved for this sponsor')}
                <Button variant="outline" onClick={copy} disabled={!template}>
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}{copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Skip</Button>
              </div>
            </TooltipProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
