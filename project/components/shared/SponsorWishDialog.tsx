'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SendMessageDialog } from '@/components/shared/SendMessageDialog';
import { wishMessageType } from '@/lib/messaging';
import { renderTemplate } from '@/lib/templates';
import { loadWishContext, type WishContext } from '@/lib/star-wish';
import type { MessageTemplate, SpecialOccasion, Sponsor } from '@/lib/types';

// Star-day wishes and donation thank-yous have their own dialogs.
const STAR_TYPES = ['Star Day Wish', 'Star Day Upcoming', 'Star Day Today', 'Thank You'];

/** Template that fits an occasion: birthday, child's birthday or anniversary wish. */
function defaultTemplateFor(templates: MessageTemplate[], occasion?: SpecialOccasion | null): MessageTemplate | undefined {
  let type = 'Birthday Wish';
  if (occasion?.occasion_type === 'Birthday' && occasion.family_member_id) type = 'Child Birthday';
  else if (occasion && /Anniversary/.test(occasion.occasion_type) && occasion.occasion_type !== 'Death Anniversary') type = 'Anniversary Wish';
  else if (occasion && occasion.occasion_type !== 'Birthday') type = 'Follow-up'; // remembrance and other events: no birthday wording
  return templates.find((t) => t.type === type) || templates[0];
}

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

  useEffect(() => {
    if (!open) return;
    loadWishContext().then((c) => {
      setCtx(c);
      const usable = c.templates.filter((t) => !STAR_TYPES.includes(t.type));
      setTemplateId(defaultTemplateFor(usable, occasion)?.id || '');
    });
  }, [open, occasion]);

  const templates = useMemo(() => (ctx?.templates || []).filter((t) => !STAR_TYPES.includes(t.type)), [ctx]);
  const template = templates.find((t) => t.id === templateId);
  const text = useMemo(() => {
    if (!ctx || !template) return null;
    const date = occasionDate
      ? new Date(`${occasionDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
      : '';
    return renderTemplate(template, {
      sponsor_name: sponsor.preferred_name || sponsor.full_name,
      person_name: occasion?.person_name || sponsor.full_name,
      occasion: occasion?.occasion_type || 'special day',
      date,
      contact_phone: ctx.contactPhone,
    }, ctx.organizationNames);
  }, [ctx, template, sponsor, occasion, occasionDate]);

  return (
    <SendMessageDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Send WhatsApp Wish"
      sponsorId={skipLog ? null : sponsor.id}
      sponsorName={sponsor.preferred_name || sponsor.full_name}
      phone={sponsor.whatsapp || sponsor.phone}
      messageType={wishMessageType(occasion?.occasion_type)}
      typeLabel={occasion ? `${occasion.occasion_type === 'Other' ? 'Event' : occasion.occasion_type} Wish` : 'Wish'}
      initialText={text}
      relatedEventId={relatedEventId}
      occurrenceDate={occasionDate}
      onLogged={() => onSent?.()}
    >
      {templates.length > 0 ? (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : ctx ? (
        <p className="text-sm text-muted-foreground">No message templates yet. Add one in Settings → Message Templates.</p>
      ) : null}
    </SendMessageDialog>
  );
}
