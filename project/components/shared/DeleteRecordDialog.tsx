'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';

export type DeletableRecord =
  | { kind: 'donation'; id: string; sponsor_id: string | null; amount: number | null; people_helped: number | null; label: string }
  | { kind: 'sponsorship'; id: string; label: string };

interface DeleteRecordDialogProps {
  record: DeletableRecord | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (record: DeletableRecord) => void;
}

const TABLE = { donation: 'donations', sponsorship: 'sponsorship_requests' } as const;
const NOUN = { donation: 'donation', sponsorship: 'sponsorship request' } as const;

export function DeleteRecordDialog({ record, onOpenChange, onDeleted }: DeleteRecordDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!record) return;
    setBusy(true); setError('');
    // .select() returns the deleted rows: RLS silently skips rows the caller may
    // not delete, so an empty result means "not allowed", not success.
    const { data, error: err } = await supabase.from(TABLE[record.kind]).delete().eq('id', record.id).select('id');
    if (err) { setBusy(false); setError(`Unable to delete this ${NOUN[record.kind]}. Please try again.`); return; }
    if (!data?.length) { setBusy(false); setError(`Only admins can delete ${NOUN[record.kind]}s.`); return; }

    // Sponsor totals are recalculated from donations by the database (migration 00027).
    notifyDrawerDataChanged();

    setBusy(false);
    onDeleted(record);
    onOpenChange(false);
  }

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!busy) { setError(''); onOpenChange(open); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />Delete {record ? NOUN[record.kind] : ''}?
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{record?.label}</strong> will be permanently deleted. This cannot be undone.
            {record?.kind === 'donation' && ' Every total (Donations, Dashboard, Reports, the sponsor) updates to match.'}
            {record?.kind === 'sponsorship' && ' Any follow-up tasks for it are deleted too; donations recorded against it are kept.'}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />{busy ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
