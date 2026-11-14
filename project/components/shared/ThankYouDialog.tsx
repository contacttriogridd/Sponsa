'use client';

import { useEffect, useMemo, useState } from 'react';
import { SendMessageDialog } from '@/components/shared/SendMessageDialog';
import { supabase } from '@/lib/supabase/client';
import { normalizeDonationType } from '@/lib/constants';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import {
  defaultThanksLanguage, donationSummary, fillKnown, thankYouData, thankYouTemplatesFrom, thanksBlockReason,
  type ThankYouLanguage,
} from '@/lib/thank-you';
import { cn } from '@/lib/utils';
import type { Donation, Sponsor } from '@/lib/types';

interface ThankYouDialogProps {
  sponsor: Pick<Sponsor, 'id' | 'full_name' | 'preferred_name' | 'phone' | 'whatsapp' | 'email'>;
  donation: Donation | null;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  /** Reminder this came from, so the dashboard card can show it was sent today. */
  relatedEventId?: string | null;
  occurrenceDate?: string | null;
  /** Sponsor record for the log; null for a monthly sponsor. Defaults to sponsor.id. */
  logSponsorId?: string | null;
}

const LANGUAGES: { value: ThankYouLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
];

/**
 * Send Thanks / Resend for one donation: the English or Tamil thank-you note
 * filled from that donation's amount and date, editable for this send only.
 */
export function ThankYouDialog({ sponsor, donation, onOpenChange, onSent, relatedEventId, occurrenceDate, logSponsorId }: ThankYouDialogProps) {
  const [settings, setSettings] = useState<{ templates: Record<ThankYouLanguage, string>; names: OrganizationNames } | null>(null);
  const [language, setLanguage] = useState<ThankYouLanguage>(defaultThanksLanguage(sponsor));

  // Keyed on IDs: callers rebuild the sponsor object on every render.
  const donationId = donation?.id;
  const startLanguage = defaultThanksLanguage(sponsor);
  useEffect(() => {
    if (!donationId) return;
    setSettings(null);
    setLanguage(startLanguage);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
      if (!cancelled) setSettings({ templates: thankYouTemplatesFrom(data), names: organizationNamesFrom(data) });
    })();
    return () => { cancelled = true; };
  }, [donationId, sponsor.id, startLanguage]);

  const text = useMemo(() => (settings && donation
    ? fillKnown(settings.templates[language], thankYouData(sponsor, donation, settings.names, language))
    : null), [settings, donation, sponsor, language]);

  return (
    <SendMessageDialog
      open={!!donation}
      onOpenChange={onOpenChange}
      title="Send Thank You Message"
      sponsorId={logSponsorId === undefined ? sponsor.id : logSponsorId}
      sponsorName={sponsor.full_name}
      phone={sponsor.whatsapp || sponsor.phone}
      extraChannels={{ smsPhone: sponsor.phone || sponsor.whatsapp, email: sponsor.email }}
      messageType="donation_thanks"
      typeLabel={donation ? `Donation Thanks – ${normalizeDonationType(donation.type)} (${donationSummary(donation)})` : 'Donation Thanks'}
      initialText={text}
      relatedDonationId={donation?.id}
      relatedEventId={relatedEventId}
      occurrenceDate={occurrenceDate || donation?.donation_date}
      sendLabel="Open WhatsApp"
      blockReason={(current) => (donation ? thanksBlockReason(current, donation) : null)}
      onLogged={() => onSent?.()}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Language</span>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Message language">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={language === l.value}
              onClick={() => setLanguage(l.value)}
              className={cn('px-3 py-1 text-sm rounded-md transition-colors', language === l.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </SendMessageDialog>
  );
}
