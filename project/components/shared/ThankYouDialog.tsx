'use client';

import { useEffect, useMemo, useState } from 'react';
import { SendMessageDialog } from '@/components/shared/SendMessageDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { normalizeDonationType } from '@/lib/constants';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import {
  THANKS_LANGUAGE_OPTIONS, buildThankYouMessage, donationSummary, thankYouTemplatesFrom, thanksBlockReason, thanksLanguageChoice,
  type ThankYouLanguage, type ThanksLanguageChoice,
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

/**
 * Send Thanks / Resend for one donation: the English, Tamil or combined
 * ("Both") thank-you note filled from that donation's amount and date,
 * editable for this send only.
 */
export function ThankYouDialog({ sponsor, donation, onOpenChange, onSent, relatedEventId, occurrenceDate, logSponsorId }: ThankYouDialogProps) {
  const { appUser } = useAuth();
  const [settings, setSettings] = useState<{ templates: Record<ThankYouLanguage, string>; names: OrganizationNames } | null>(null);
  const [language, setLanguage] = useState<ThanksLanguageChoice>('ta');
  const [pending, setPending] = useState<ThanksLanguageChoice | null>(null);

  // Keyed on IDs: callers rebuild the sponsor object on every render.
  const donationId = donation?.id;
  const userId = appUser?.id;
  useEffect(() => {
    if (!donationId) return;
    setSettings(null);
    setPending(null);
    let cancelled = false;
    (async () => {
      const [{ data: org }, { data: me }] = await Promise.all([
        supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
        // Column added by migration 00022; before it, this just finds nothing.
        userId ? supabase.from('app_users').select('thank_you_language').eq('id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setLanguage(thanksLanguageChoice((me as { thank_you_language?: string } | null)?.thank_you_language, org?.thank_you_language));
      setSettings({ templates: thankYouTemplatesFrom(org), names: organizationNamesFrom(org) });
    })();
    return () => { cancelled = true; };
  }, [donationId, userId]);

  const text = useMemo(() => (settings && donation
    ? buildThankYouMessage(settings.templates, sponsor, donation, settings.names, language)
    : null), [settings, donation, sponsor, language]);

  /** Switches language and remembers it as this user's default for next time. */
  function choose(choice: ThanksLanguageChoice) {
    setPending(null);
    setLanguage(choice);
    if (userId) supabase.from('app_users').update({ thank_you_language: choice }).eq('id', userId).then(() => undefined);
  }

  return (
    <>
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
        {({ edited }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Language</span>
            <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Message language">
              {THANKS_LANGUAGE_OPTIONS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={language === l.value}
                  disabled={!settings}
                  onClick={() => { if (l.value !== language) { if (edited) setPending(l.value); else choose(l.value); } }}
                  className={cn('px-3 py-1 text-sm rounded-md transition-colors', language === l.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </SendMessageDialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Discard your edits?"
        description="Switching language replaces the message with the new template, and your changes to the text will be lost."
        confirmLabel="Discard edits"
        destructive
        onConfirm={() => pending && choose(pending)}
      />
    </>
  );
}
