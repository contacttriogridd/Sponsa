'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendMessageDialog } from '@/components/shared/SendMessageDialog';
import {
  OCCASION_TEMPLATES, fillOccasionMessage, occasionContact, occasionMessageType, occasionSendLabel, occasionTemplateType, occasionTitle, occasionVariables,
  type OccasionTemplateType,
} from '@/lib/occasion-details';
import { renderTemplate } from '@/lib/templates';
import { loadWishContext, type WishContext } from '@/lib/star-wish';
import type { MessageTemplate, SpecialOccasion, Sponsor } from '@/lib/types';

// Star-day wishes and donation thank-yous have their own dialogs.
const STAR_TYPES = ['Star Day Wish', 'Star Day Upcoming', 'Star Day Today', 'Thank You'];

interface SponsorWishDialogProps {
  sponsor: Sponsor;
  occasion?: SpecialOccasion | null;
  /** Date of the occasion (YYYY-MM-DD), for {{date}} and the log. */
  occasionDate?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  /** No sponsor record behind this person (e.g. a monthly sponsor): don't link the log to one. */
  skipLog?: boolean;
  /** Reminder this came from, so the dashboard card can show it was sent today. */
  relatedEventId?: string | null;
}

/** Send a wish: the shared Send Message modal with a template picker. */
export function SponsorWishDialog({ sponsor, occasion, occasionDate, open, onOpenChange, onSent, skipLog, relatedEventId }: SponsorWishDialogProps) {
  const [ctx, setCtx] = useState<WishContext | null>(null);
  const [templateId, setTemplateId] = useState('');

  // Occasion templates from the database, or the built-in text if one is missing.
  const templates = useMemo(() => {
    const stored = (ctx?.templates || []).filter((t) => !STAR_TYPES.includes(t.type));
    const builtIn = (Object.keys(OCCASION_TEMPLATES) as OccasionTemplateType[])
      .filter((type) => !stored.some((t) => t.type === type))
      .map((type) => ({ id: `builtin:${type}`, type, name: OCCASION_TEMPLATES[type].name, body: OCCASION_TEMPLATES[type].body }));
    return [...builtIn, ...stored];
  }, [ctx]);

  useEffect(() => {
    if (open) loadWishContext().then(setCtx);
  }, [open]);

  useEffect(() => {
    if (!ctx) return;
    const wanted = occasionTemplateType(occasion || { person_name: sponsor.full_name, occasion_type: 'Birthday', relationship: 'Self' });
    setTemplateId(templates.find((t) => t.type === wanted)?.id || '');
  }, [ctx, templates, occasion, sponsor.full_name]);

  const subject = occasion || { person_name: sponsor.full_name, occasion_type: 'Other' };
  const contact = occasionContact(occasion, sponsor);
  const template = templates.find((t) => t.id === templateId);
  const text = useMemo(() => {
    if (!ctx || !template) return null;
    const vars = occasionVariables(subject, sponsor, occasionDate, ctx.organizationNames);
    if (template.type.startsWith('Occasion:')) return fillOccasionMessage(template.body, vars);
    return renderTemplate(template.body, { ...vars, sponsor_name: contact.name, contact_phone: ctx.contactPhone }, ctx.organizationNames);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, template, sponsor, occasion, occasionDate]);

  return (
    <SendMessageDialog
      open={open}
      onOpenChange={onOpenChange}
      title={occasionSendLabel(occasion)}
      sendLabel={occasionSendLabel(occasion)}
      sponsorId={skipLog ? null : sponsor.id}
      sponsorName={sponsor.full_name}
      contactName={contact.name}
      phone={contact.phone}
      messageType={occasionMessageType(occasion)}
      typeLabel={occasion ? occasionSendLabel(occasion).replace('Send ', '') : 'Wish'}
      initialText={text}
      relatedEventId={relatedEventId}
      occurrenceDate={occasionDate}
      occasionId={occasion?.id}
      occasionType={occasion?.occasion_type_key || occasion?.occasion_type}
      occasionTitle={occasion ? occasionTitle(occasion, sponsor.full_name) : null}
      onLogged={() => onSent?.()}
    >
      {templates.length > 0 && (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </SendMessageDialog>
  );
}
