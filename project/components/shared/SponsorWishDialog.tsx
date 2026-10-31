'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WishComposer } from '@/components/shared/WishComposer';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
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
  /** Next date of the occasion (YYYY-MM-DD), for {{date}}. */
  occasionDate?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  /** Skip the contact log (for a person with no sponsor record). */
  skipLog?: boolean;
}

/** Send Wish from the sponsor drawer: choose a template, edit, then WhatsApp or copy; logged as an interaction. */
export function SponsorWishDialog({ sponsor, occasion, occasionDate, open, onOpenChange, onSent, skipLog }: SponsorWishDialogProps) {
  const { appUser } = useAuth();
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
    if (!ctx || !template) return '';
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

  async function log(channel: 'whatsapp' | 'copy') {
    if (skipLog) { onSent?.(); return; }
    await Promise.all([
      supabase.from('interactions').insert({
        sponsor_id: sponsor.id,
        type: channel === 'whatsapp' ? 'whatsapp' : 'other',
        summary: `${template?.name || 'Wish'} ${channel === 'whatsapp' ? 'sent via WhatsApp' : 'copied'}${occasion ? ` (${occasion.occasion_type})` : ''}`,
        interaction_date: new Date().toISOString(),
        conducted_by: appUser?.id || null,
      }),
      supabase.from('sponsors').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', sponsor.id),
    ]);
    onSent?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Wish — {sponsor.preferred_name || sponsor.full_name}</DialogTitle>
        </DialogHeader>
        {!ctx ? (
          <div className="h-64 rounded-md bg-muted animate-pulse" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No message templates yet. Add one in Settings → Message Templates.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <WishComposer initialText={text} phone={sponsor.whatsapp || sponsor.phone} onSend={(c) => log(c)} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
