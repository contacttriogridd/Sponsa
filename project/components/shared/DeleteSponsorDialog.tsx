'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';

interface DeleteSponsorDialogProps {
  sponsor: { id: string; full_name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (sponsorId: string) => void;
}

// Every table below references sponsors(id) ON DELETE CASCADE, so deleting the
// sponsor row removes all of these in the same database transaction.
const RELATED: { table: string; label: string }[] = [
  { table: 'family_members', label: 'family members' },
  { table: 'special_occasions', label: 'special days' },
  { table: 'donations', label: 'donations' },
  { table: 'sponsorship_requests', label: 'sponsorship requests' },
  { table: 'interactions', label: 'interactions' },
  { table: 'tasks', label: 'follow-up tasks' },
  { table: 'reminders', label: 'reminders' },
  { table: 'notifications', label: 'notifications' },
  { table: 'whatsapp_messages', label: 'WhatsApp messages' },
];

const CONFIRM_WORD = 'DELETE';

export function DeleteSponsorDialog({ sponsor, onOpenChange, onDeleted }: DeleteSponsorDialogProps) {
  const [counts, setCounts] = useState<{ label: string; count: number }[] | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sponsor) return;
    setConfirmText(''); setError(''); setCounts(null);
    let cancelled = false;
    (async () => {
      const results = await Promise.all(RELATED.map(({ table }) =>
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('sponsor_id', sponsor.id)));
      if (cancelled) return;
      setCounts(RELATED.map(({ label }, i) => ({ label, count: results[i].count || 0 })).filter((c) => c.count > 0));
    })();
    return () => { cancelled = true; };
  }, [sponsor]);

  async function handleDelete() {
    if (!sponsor) return;
    setBusy(true); setError('');
    // .select() returns the deleted rows: RLS silently skips rows the caller may
    // not delete, so an empty result means "not allowed", not success.
    const { data, error: err } = await supabase.from('sponsors').delete().eq('id', sponsor.id).select('id');
    setBusy(false);
    if (err) { setError('Unable to delete this sponsor. Please try again.'); return; }
    if (!data?.length) { setError('Only admins can delete sponsors.'); return; }
    onDeleted(sponsor.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={!!sponsor} onOpenChange={(open) => { if (!busy) onOpenChange(open); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />Delete sponsor permanently?
          </DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{sponsor?.full_name}</strong> and all of their data will be erased. This cannot be undone.
            To keep their history instead, use <strong className="text-foreground">Archive</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm">
          {counts === null ? (
            <span className="text-muted-foreground">Checking linked records...</span>
          ) : counts.length === 0 ? (
            <span>Only the sponsor profile will be removed — no linked records.</span>
          ) : (
            <>
              <div className="font-medium mb-1">This will also delete:</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {counts.map((c) => <li key={c.label}>{c.count} {c.label}</li>)}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-delete" className="text-sm">
            Type <strong>{CONFIRM_WORD}</strong> to confirm
          </label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={busy || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />{busy ? 'Deleting...' : 'Delete permanently'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
