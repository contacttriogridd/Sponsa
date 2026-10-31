'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { OccasionFields } from '@/components/shared/OccasionFields';
import { supabase } from '@/lib/supabase/client';
import { occasionKeyOf } from '@/lib/occasion-details';
import { draftFromOccasion, draftToRow, newDraft, validateDraft, type OccasionDraft } from '@/lib/occasion-draft';
import { useOccasionTypes } from '@/lib/use-occasion-types';
import type { SpecialOccasion } from '@/lib/types';

interface OccasionFormProps {
  sponsorId: string;
  occasion?: SpecialOccasion;
  defaultPersonName?: string;
  /** Sponsor's details for defaults; looked up if not given. */
  sponsorPhone?: string | null;
  sponsorDob?: string | null;
  onSaved: (occasion: SpecialOccasion) => void;
  onCancel: () => void;
}

export function OccasionForm({ sponsorId, occasion, defaultPersonName, sponsorPhone, sponsorDob, onSaved, onCancel }: OccasionFormProps) {
  const types = useOccasionTypes();
  const [draft, setDraft] = useState<OccasionDraft>(() => (occasion ? draftFromOccasion(occasion, occasionKeyOf(occasion)) : newDraft('family_birthday')));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sponsor = { name: defaultPersonName || occasion?.person_name || '', phone: sponsorPhone, dob: sponsorDob };

  async function handleSubmit() {
    const type = types.find((t) => t.key === draft.type_key);
    const problem = validateDraft(draft, type, sponsor);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    const row = draftToRow(draft, type, sponsorId, sponsor);
    const { data, error: err } = occasion
      ? await supabase.from('special_occasions').update({ ...row, is_auto_generated: occasion.is_auto_generated }).eq('id', occasion.id).select().single()
      : await supabase.from('special_occasions').insert(row).select().single();
    setBusy(false);
    if (err) { setError('Unable to save. Please try again.'); return; }
    onSaved(data as SpecialOccasion);
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
      <OccasionFields value={draft} onChange={setDraft} types={types} sponsor={sponsor} />
      <div className="flex items-center gap-2">
        <Switch id="active" checked={draft.active} onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))} />
        <Label htmlFor="active" className="cursor-pointer">Active</Label>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? 'Saving...' : occasion ? 'Save Changes' : 'Add Occasion'}
        </Button>
        <Button variant="outline" onClick={onCancel}><X className="h-4 w-4 mr-2" />Cancel</Button>
      </div>
    </div>
  );
}
