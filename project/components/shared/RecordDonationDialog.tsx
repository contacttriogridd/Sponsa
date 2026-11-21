'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DonationForm } from '@/components/shared/DonationForm';
import { SponsorPicker, type PickerOption } from '@/components/shared/SponsorPicker';
import { ThankYouDialog } from '@/components/shared/ThankYouDialog';
import { supabase } from '@/lib/supabase/client';
import type { DonationCategory } from '@/lib/donations';
import type { Donation, Sponsor } from '@/lib/types';
import { ackMessageFor, loadAckContext, markAckOpened } from '@/components/shared/AcknowledgmentButton';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

export type DonorKind = 'regular' | 'monthly' | 'walkin';

export interface DonationPreset {
  sponsorType?: DonorKind;
  sponsorId?: string;
  sponsorName?: string;
  category?: DonationCategory;
  occasionDate?: string;
  occasionName?: string;
  occasionId?: string;
  sponsorshipRequestId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** From a sponsor's page or row: that sponsor, its category and occasion date are filled in. */
  preset?: DonationPreset | null;
  onSaved?: (donation: Donation) => void;
}

const KIND_LABELS: [DonorKind, string][] = [['regular', 'Sponsors'], ['monthly', 'Monthly Sponsors'], ['walkin', 'Walk-in / Anonymous']];

/**
 * Record Donation, the same from every section: it always saves one row in
 * `donations`, then offers Send Thanks. Everything listening for data changes
 * (Donations, Dashboard, sponsor pages) reloads.
 */
export function RecordDonationDialog({ open, onOpenChange, preset, onSaved }: Props) {
  const locked = !!preset?.sponsorId;
  const [kind, setKind] = useState<DonorKind>(preset?.sponsorType || 'regular');
  const [sponsorId, setSponsorId] = useState(preset?.sponsorId || '');
  const [regular, setRegular] = useState<PickerOption[]>([]);
  const [monthly, setMonthly] = useState<PickerOption[]>([]);
  const [thanking, setThanking] = useState<{ donation: Donation; sponsor: Sponsor; logSponsorId: string | null | undefined } | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(preset?.sponsorType || 'regular');
    setSponsorId(preset?.sponsorId || '');
    if (preset?.sponsorId) return;
    Promise.all([
      supabase.from('sponsors').select('id, full_name, phone, whatsapp').eq('status', 'active').order('full_name'),
      supabase.from('monthly_sponsors').select('id, name, phone, deleted_at').order('name'),
    ]).then(([s, m]) => {
      setRegular((s.data || []).map((x) => ({ id: x.id, name: x.full_name, phone: x.phone || x.whatsapp })));
      // Before migration 00027 there is no deleted_at column.
      const rows = m.error ? [] : (m.data || []).filter((x) => !x.deleted_at);
      setMonthly(rows.map((x) => ({ id: x.id, name: x.name, phone: x.phone })));
    });
  }, [open, preset]);

  const options = kind === 'monthly' ? monthly : regular;
  const chosen = locked ? { id: preset!.sponsorId!, name: preset!.sponsorName || '', phone: null } : options.find((o) => o.id === sponsorId);
  const ready = kind === 'walkin' || !!chosen;

  async function saved(donation: Donation) {
    onOpenChange(false);
    onSaved?.(donation);
    toast.success('Donation saved — Send Thanks now?');
    // Manual mode: one tap sends the acknowledgment to Udhaya Sir (automatic mode already sent it).
    const donorName = chosen?.name || donation.sponsor_name || 'Anonymous';
    Promise.all([loadAckContext(), ackMessageFor(donation, donorName)]).then(([ctx, message]) => {
      if (ctx.sendMode === 'automatic') return;
      toast(`Send the acknowledgment to ${ctx.recipient.name}?`, {
        duration: 20000,
        action: { label: 'Open WhatsApp', onClick: () => { window.open(buildWhatsAppUrl(ctx.recipient.whatsapp, message), '_blank'); markAckOpened(donation, donorName, message); } },
      });
    });
    if (kind === 'walkin' || !chosen) return;
    if (kind === 'monthly') {
      const { data } = await supabase.from('monthly_sponsors').select('id, name, phone').eq('id', chosen.id).maybeSingle();
      if (data) setThanking({ donation, logSponsorId: null, sponsor: { id: data.id, full_name: data.name, preferred_name: null, phone: data.phone, whatsapp: null, email: null } as Sponsor });
    } else {
      const { data } = await supabase.from('sponsors').select('*').eq('id', chosen.id).maybeSingle();
      if (data) setThanking({ donation, logSponsorId: undefined, sponsor: data as Sponsor });
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!locked && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Donor</label>
                  <div className="flex flex-wrap gap-1">
                    {KIND_LABELS.map(([key, label]) => (
                      <Button key={key} type="button" size="sm" variant={kind === key ? 'secondary' : 'ghost'} onClick={() => { setKind(key); setSponsorId(''); }}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                {kind !== 'walkin' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Select Sponsor</label>
                    <SponsorPicker options={options} value={sponsorId} onChange={setSponsorId} placeholder={kind === 'monthly' ? 'Choose a monthly sponsor...' : 'Choose a sponsor...'} />
                  </div>
                )}
              </>
            )}
            {ready && (
              <DonationForm
                key={`${kind}-${chosen?.id || 'walkin'}`}
                sponsorId={chosen?.id || ''}
                sponsorType={kind}
                sponsorName={chosen?.name}
                defaultCategory={preset?.category}
                occasionDate={preset?.occasionDate}
                occasionName={preset?.occasionName}
                occasionId={preset?.occasionId}
                sponsorshipRequestId={preset?.sponsorshipRequestId}
                onSaved={saved}
                onCancel={() => onOpenChange(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {thanking && (
        <ThankYouDialog
          sponsor={thanking.sponsor}
          logSponsorId={thanking.logSponsorId}
          donation={thanking.donation}
          onOpenChange={(o) => { if (!o) setThanking(null); }}
        />
      )}
    </>
  );
}

/** A "Record Donation" button that opens the dialog. */
export function RecordDonationButton({ preset, label = 'Record Donation', variant = 'default', size = 'default', onSaved }: {
  preset?: DonationPreset | null; label?: string; variant?: 'default' | 'outline' | 'secondary' | 'ghost'; size?: 'default' | 'sm'; onSaved?: (d: Donation) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-1.5" />{label}
      </Button>
      <RecordDonationDialog open={open} onOpenChange={setOpen} preset={preset} onSaved={onSaved} />
    </>
  );
}
