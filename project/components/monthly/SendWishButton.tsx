'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WishComposer } from '@/components/shared/WishComposer';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { renderTemplate } from '@/lib/templates';
import { STARS } from '@/lib/natchathiram';
import { daysBetween, formatStarDate, todayIst, whenLabel } from '@/lib/monthly-sponsors';
import { loadWishContext, pickStarTemplate, starDayVariables } from '@/lib/star-wish';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import type { MonthlySponsor } from '@/lib/types';

interface SendWishButtonProps {
  sponsor: MonthlySponsor;
  /** The star day being wished for (YYYY-MM-DD). */
  starDate: string;
  size?: 'sm' | 'default';
}

/**
 * Send Wish for a monthly sponsor's star day: picks "Star day today" or
 * "Star day upcoming", fills the placeholders, lets the user edit, then opens
 * WhatsApp or copies — and records it in the wish history.
 */
export function SendWishButton({ sponsor, starDate, size = 'sm' }: SendWishButtonProps) {
  const { appUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [composed, setComposed] = useState<{ text: string; type: string; name: string } | null>(null);
  const daysLeft = daysBetween(todayIst(), starDate);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadWishContext().then(({ templates, organizationNames, contactPhone }) => {
      if (cancelled) return;
      const template = pickStarTemplate(templates, daysLeft);
      const text = renderTemplate(template.body, starDayVariables(sponsor, starDate, daysLeft, contactPhone), organizationNames);
      setComposed({ text, type: template.type, name: template.name });
    });
    return () => { cancelled = true; };
  }, [open, sponsor, starDate, daysLeft]);

  async function log(channel: 'whatsapp' | 'copy', message: string) {
    // Best effort: the history table arrives with migration 00012.
    await supabase.from('monthly_wish_log').insert({
      monthly_sponsor_id: sponsor.id, star_date: starDate, template_type: composed?.type || null,
      channel, message, sent_by: appUser?.id || null,
    });
    notifyDrawerDataChanged();
  }

  return (
    <>
      <Button
        size={size}
        variant="outline"
        className="text-green-600 border-green-200 hover:bg-green-50"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <MessageCircle className="h-4 w-4 mr-1.5" />Send Wish
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Send Wish — {sponsor.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            {sponsor.star != null && `${STARS[sponsor.star].ta} (${STARS[sponsor.star].en}) · `}
            {formatStarDate(starDate)} · {whenLabel(daysLeft)}
            {composed && <> · Template: <span className="font-medium text-foreground">{composed.name}</span></>}
          </p>
          {composed ? (
            <WishComposer initialText={composed.text} phone={sponsor.phone} onSend={log} />
          ) : (
            <div className="h-64 rounded-md bg-muted animate-pulse" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
