'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { OccasionTypeRow } from '@/lib/occasion-draft';
import type { OccasionCategory } from '@/lib/occasion-details';

const CATEGORIES: { value: OccasionCategory; label: string }[] = [
  { value: 'birthday', label: 'Birthday' }, { value: 'anniversary', label: 'Anniversary' },
  { value: 'remembrance', label: 'Remembrance' }, { value: 'other', label: 'Other' },
];

const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function OccasionTypesPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [types, setTypes] = useState<OccasionTypeRow[]>([]);
  const [notReady, setNotReady] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ name_en: '', name_ta: '', icon: '✨', category: 'other' as OccasionCategory, needs_person_name: false });

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('occasion_types').select('*').order('sort_order');
    if (err) setNotReady(true);
    setTypes((data || []) as OccasionTypeRow[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const patchLocal = (id: string, patch: Partial<OccasionTypeRow>) => setTypes((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  async function save(t: OccasionTypeRow, patch: Partial<OccasionTypeRow> = {}) {
    setError('');
    const { error: err } = await supabase.from('occasion_types').update({
      name_en: t.name_en.trim(), name_ta: t.name_ta.trim(), icon: t.icon.trim() || '✨', is_active: t.is_active, ...patch,
    }).eq('id', t.id!);
    if (err) setError('Unable to save. Please try again.');
    load();
  }

  async function move(index: number, delta: number) {
    const other = types[index + delta];
    const current = types[index];
    if (!other) return;
    // Gaps of 10 aren't guaranteed, so write the whole order.
    const next = [...types];
    next[index] = other;
    next[index + delta] = current;
    setTypes(next);
    await Promise.all(next.map((t, i) => supabase.from('occasion_types').update({ sort_order: (i + 1) * 10 }).eq('id', t.id!)));
    load();
  }

  async function add() {
    setError('');
    const name = draft.name_en.trim();
    if (!name) { setError('Enter the English name.'); return; }
    const { error: err } = await supabase.from('occasion_types').insert({
      key: `${slug(name) || 'type'}_${Date.now().toString(36)}`,
      name_en: name, name_ta: draft.name_ta.trim(), icon: draft.icon.trim() || '✨', category: draft.category,
      needs_person_name: draft.needs_person_name, sort_order: (types.length + 1) * 10,
    });
    if (err) { setError('Unable to add. Please try again.'); return; }
    setDraft({ name_en: '', name_ta: '', icon: '✨', category: 'other', needs_person_name: false });
    load();
  }

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">Settings</p>
          <h1 className="text-2xl font-semibold mt-1">Occasion Types</h1>
          <p className="text-sm text-muted-foreground mt-1">The choices in Add Sponsor → Sponsoring For. A type&apos;s category decides which message it uses.</p>
        </div>
        {notReady && <Card className="p-6 text-sm text-muted-foreground">Occasion Types needs database migration 00017.</Card>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!isAdmin && !notReady && <p className="text-sm text-muted-foreground">Only an admin can change occasion types.</p>}

        <div className="grid gap-3">
          {types.map((t, i) => (
            <Card key={t.id} className={`p-4 ${t.is_active ? '' : 'opacity-60'}`}>
              <div className="grid sm:grid-cols-[4rem_1fr_1fr] gap-3">
                <div className="space-y-1"><Label className="text-xs">Icon</Label><Input value={t.icon} disabled={!isAdmin} onChange={(e) => patchLocal(t.id!, { icon: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">English</Label><Input value={t.name_en} disabled={!isAdmin} onChange={(e) => patchLocal(t.id!, { name_en: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Tamil</Label><Input lang="ta" value={t.name_ta} disabled={!isAdmin} onChange={(e) => patchLocal(t.id!, { name_ta: e.target.value })} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground capitalize mr-auto">{t.category}</span>
                <div className="flex items-center gap-2 mr-2">
                  <Switch id={`active-${t.id}`} checked={t.is_active} disabled={!isAdmin} onCheckedChange={(v) => { patchLocal(t.id!, { is_active: v }); save(t, { is_active: v }); }} />
                  <Label htmlFor={`active-${t.id}`} className="cursor-pointer text-xs">Active</Label>
                </div>
                <Button variant="ghost" size="icon" aria-label="Move up" disabled={!isAdmin || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Move down" disabled={!isAdmin || i === types.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" disabled={!isAdmin} onClick={() => save(t)}><Save className="h-4 w-4 mr-1.5" />Save</Button>
              </div>
            </Card>
          ))}
        </div>

        {isAdmin && !notReady && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add an occasion type</h3>
            <div className="grid sm:grid-cols-[4rem_1fr_1fr] gap-3">
              <div className="space-y-1"><Label className="text-xs">Icon</Label><Input value={draft.icon} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">English</Label><Input value={draft.name_en} onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))} placeholder="e.g. House Warming" /></div>
              <div className="space-y-1"><Label className="text-xs">Tamil</Label><Input lang="ta" value={draft.name_ta} onChange={(e) => setDraft((d) => ({ ...d, name_ta: e.target.value }))} /></div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-40">
                <Label className="text-xs">Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v as OccasionCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch id="needs-person" checked={draft.needs_person_name} onCheckedChange={(v) => setDraft((d) => ({ ...d, needs_person_name: v }))} />
                <Label htmlFor="needs-person" className="cursor-pointer text-xs">Person&apos;s name required</Label>
              </div>
              <Button onClick={add} className="ml-auto"><Plus className="h-4 w-4 mr-1.5" />Add</Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
