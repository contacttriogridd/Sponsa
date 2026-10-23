'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { renderTemplate } from '@/lib/templates';
import { useOrganizationNames } from '@/lib/use-organization-names';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { starWishVariables } from '@/lib/monthly-sponsors';
import type { MonthlySponsor } from '@/lib/types';

/** Used if the "Star Day Wish" template hasn't been added to the database yet (migration 00011). */
export const DEFAULT_STAR_WISH_BODY = `அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

உங்கள் நட்சத்திர நாளான {{star_date}} அன்று ({{star_name}} நட்சத்திரம், {{raasi_name}} ராசி), இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற்று வாழ வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Warm wishes on your star day, {{star_date}}. May you and your family be blessed with good health and happiness. Thank you for your continued monthly support.

With gratitude,
{{organization_name}}`;

/** WhatsApp number for wa.me: digits only, with India's code added to a 10-digit mobile number. */
export function whatsappNumber(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Returns a builder for star-day wishes: the rendered "Star Day Wish"
 * template and a wa.me link (percent-encoded, so Tamil text and line breaks
 * arrive intact). With no number, wa.me lets the user pick the chat.
 */
export function useStarWish() {
  const organizationNames = useOrganizationNames();
  const [body, setBody] = useState(DEFAULT_STAR_WISH_BODY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('message_templates')
        .select('body, is_approved')
        .eq('type', 'Star Day Wish')
        .order('is_approved', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.body) setBody(data.body);
    })();
    return () => { cancelled = true; };
  }, []);

  return useCallback((sponsor: MonthlySponsor, starDate: string) => {
    const message = renderTemplate(body, starWishVariables(sponsor, starDate), organizationNames);
    return { message, url: buildWhatsAppUrl(whatsappNumber(sponsor.phone), message) };
  }, [body, organizationNames]);
}
