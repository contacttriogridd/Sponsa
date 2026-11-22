'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ExternalLink, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PhoneInput, phoneForSave } from '@/components/shared/PhoneInput';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { notifyDrawerDataChanged, openMonthlySponsorDrawer } from '@/lib/drawer-store';
import { loadPhoneIssues } from '@/lib/numbers-to-fix-store';
import type { PhoneIssue } from '@/lib/numbers-to-fix';

/** Admin: saved phone numbers that are not valid, with where each is used and a quick fix. */
export default function NumbersToFixPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [issues, setIssues] = useState<PhoneIssue[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => { loadPhoneIssues().then(setIssues); }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function save(issue: PhoneIssue) {
    const fixed = phoneForSave(edits[issue.key] ?? issue.value);
    if (!fixed.value) { toast.error(fixed.error || 'Enter a valid 10-digit mobile number'); return; }
    setBusy(issue.key);
    const { error } = await supabase.from(issue.table).update({ [issue.column]: fixed.value }).eq('id', issue.id);
    setBusy(null);
    if (error) { toast.error('Unable to save. Please try again.'); return; }
    toast.success(`${issue.name}: saved as ${fixed.value}`);
    setIssues((list) => (list || []).filter((i) => i.key !== issue.key));
    notifyDrawerDataChanged();
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-4xl">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Numbers to fix {issues && issues.length > 0 && <Badge variant="destructive">{issues.length}</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            These saved numbers are not valid mobile numbers, so WhatsApp, SMS and calls to them are blocked. Enter the 10-digit number and save — it is stored as +91XXXXXXXXXX.
          </p>
        </div>

        {!isAdmin ? (
          <Card className="p-6 text-sm text-muted-foreground">Only an admin can see this page.</Card>
        ) : issues === null ? (
          <Card className="p-6 text-sm text-muted-foreground">Checking every number…</Card>
        ) : issues.length === 0 ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
            <h3 className="font-semibold">All numbers are valid</h3>
          </Card>
        ) : (
          <div className="grid gap-2">
            {issues.map((issue) => (
              <Card key={issue.key} className="p-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{issue.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{issue.where} · now <code className="bg-muted px-1 rounded">{issue.value}</code></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneInput value={edits[issue.key] ?? issue.value} onChange={(v) => setEdits((e) => ({ ...e, [issue.key]: v }))} className="w-48" />
                    <Button size="sm" onClick={() => save(issue)} disabled={busy === issue.key}><Save className="h-4 w-4 mr-1" />Save</Button>
                    {issue.monthlyId ? (
                      <Button size="sm" variant="outline" onClick={() => openMonthlySponsorDrawer(issue.monthlyId!)}><ExternalLink className="h-4 w-4 mr-1" />Edit</Button>
                    ) : issue.href ? (
                      <Link href={issue.href}><Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Edit</Button></Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
