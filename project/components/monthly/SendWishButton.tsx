'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WishComposer } from '@/components/shared/WishComposer';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { renderTemplate } from '@/lib/templates';
import { STARS } from '@/lib/natchathiram';
import { daysBetween, formatStarDate, todayIst, whenLabel } from '@/lib/monthly-sponsors';
import { loadWishContext, pickStarTemplate, starDayVariables, whatsappNumber, type WishContext } from '@/lib/star-wish';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import type { MonthlySponsor } from '@/lib/types';

interface SendWishButtonProps {
  sponsor: MonthlySponsor;
  /** The star day being wished for (YYYY-MM-DD). */
  starDate: string;
  size?: 'sm' | 'default';
}

/**
 * Send Wish for a monthly sponsor's star day. One click opens WhatsApp on the
 * sponsor's chat with the wish already typed ("Star day today" on the day,
 * "Star day upcoming" before it). The pencil opens the message to edit or
 * copy first. Every send is recorded in the wish history.
 *
 * The number is the monthly sponsor's own, or — for a child or relative with
 * no number of their own — the linked sponsor's WhatsApp / phone number.
 */
export function SendWishButton({ sponsor, starDate, size = 'sm' }: SendWishButtonProps) {
  const { appUser } = useAuth();
  const [ctx, setCtx] = useState<WishContext | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const daysLeft = daysBetween(todayIst(), starDate);

  // Prepare the message up front so the click opens WhatsApp straight away
  // (a link opened after waiting for data would be blocked as a pop-up).
  useEffect(() => {
    let cancelled = false;
    loadWishContext().then((c) => { if (!cancelled) setCtx(c); });
    if (!sponsor.phone && sponsor.sponsor_id) {
      supabase.from('sponsors').select('whatsapp, phone').eq('id', sponsor.sponsor_id).maybeSingle()
        .then(({ data }) => { if (!cancelled) setLinkedPhone(data?.whatsapp || data?.phone || null); });
    }
    return () => { cancelled = true; };
  }, [sponsor.phone, sponsor.sponsor_id]);

  const phone = sponsor.phone || linkedPhone;
  const number = whatsappNumber(phone);
  const composed = useMemo(() => {
    if (!ctx) return null;
    const template = pickStarTemplate(ctx.templates, daysLeft);
    const text = renderTemplate(template.body, starDayVariables(sponsor, starDate, daysLeft, ctx.contactPhone), ctx.organizationNames);
    return { text, type: template.type, name: template.name };
  }, [ctx, sponsor, starDate, daysLeft]);

  async function log(channel: 'whatsapp' | 'copy', message: string) {
    // Best effort: the history table arrives with migration 00012.
    await supabase.from('monthly_wish_log').insert({
      monthly_sponsor_id: sponsor.id, star_date: starDate, template_type: composed?.type || null,
      channel, message, sent_by: appUser?.id || null,
    });
    notifyDrawerDataChanged();
  }

  const sendButton = (
    <Button
      size={size}
      variant="outline"
      disabled={!composed}
      className="text-green-600 border-green-200 hover:bg-green-50 rounded-r-none"
      title={number ? `Open WhatsApp chat with +${number}` : 'No mobile number saved'}
    >
      <MessageCircle className="h-4 w-4 mr-1.5" />Send Wish
    </Button>
  );

  return (
    <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
      {composed && number ? (
        <a href={buildWhatsAppUrl(number, composed.text)} target="_blank" rel="noreferrer" onClick={() => log('whatsapp', composed.text)}>
          {sendButton}
        </a>
      ) : (
        // No number: show the message so it can be sent from the right chat or copied.
        <span onClick={() => composed && setEditing(true)}>{sendButton}</span>
      )}
      <Button
        size={size === 'sm' ? 'sm' : 'default'}
        variant="outline"
        disabled={!composed}
        aria-label="Edit message before sending"
        title="Edit message before sending"
        className="text-green-600 border-green-200 hover:bg-green-50 rounded-l-none border-l-0 px-2"
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Send Wish — {sponsor.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {sponsor.star != null && `${STARS[sponsor.star].ta} (${STARS[sponsor.star].en}) · `}
            {formatStarDate(starDate)} · {whenLabel(daysLeft)}
            {composed && <> · Template: <span className="font-medium text-foreground">{composed.name}</span></>}
          </p>
          <p className="text-sm">
            {number
              ? <>WhatsApp chat: <span className="font-medium">+{number}</span>{!sponsor.phone && linkedPhone ? ' (linked sponsor’s number)' : ''}</>
              : <span className="text-warning">No mobile number saved for {sponsor.name}. Add one with Edit, or open WhatsApp and pick the chat yourself.</span>}
          </p>
          {composed && <WishComposer initialText={composed.text} phone={phone} onSend={log} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
