'use client';

import { useEffect, useState } from 'react';
import { SendMessageDialog } from '@/components/shared/SendMessageDialog';
import { supabase } from '@/lib/supabase/client';
import { normalizeDonationType } from '@/lib/constants';
import { organizationNamesFrom } from '@/lib/organization';
import { donationSummary, fillTemplate, thankYouData, thankYouTemplateFrom } from '@/lib/thank-you';
import type { Donation, Sponsor } from '@/lib/types';

interface ThankYouDialogProps {
  sponsor: Pick<Sponsor, 'id' | 'full_name' | 'preferred_name' | 'phone' | 'whatsapp' | 'email'>;
  donation: Donation | null;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  /** Reminder this came from, so the dashboard card can show it was sent today. */
  relatedEventId?: string | null;
  occurrenceDate?: string | null;
}

/** Send Thanks for a donation: the shared Send Message modal, pre-filled from the donation record. */
export function ThankYouDialog({ sponsor, donation, onOpenChange, onSent, relatedEventId, occurrenceDate }: ThankYouDialogProps) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!donation) return;
    setText(null);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
      if (cancelled) return;
      setText(fillTemplate(thankYouTemplateFrom(data), thankYouData(sponsor, donation, organizationNamesFrom(data))));
    })();
    return () => { cancelled = true; };
  }, [donation, sponsor]);

  return (
    <SendMessageDialog
      open={!!donation}
      onOpenChange={onOpenChange}
      title="Send Thank You Message"
      sponsorId={sponsor.id}
      sponsorName={sponsor.full_name}
      phone={sponsor.whatsapp || sponsor.phone}
      extraChannels={{ smsPhone: sponsor.phone || sponsor.whatsapp, email: sponsor.email }}
      messageType="donation_thanks"
      typeLabel={donation ? `Donation Thanks – ${normalizeDonationType(donation.type)} (${donationSummary(donation)})` : 'Donation Thanks'}
      initialText={text}
      relatedDonationId={donation?.id}
      relatedEventId={relatedEventId}
      occurrenceDate={occurrenceDate || donation?.donation_date}
      onLogged={() => onSent?.()}
    />
  );
}
