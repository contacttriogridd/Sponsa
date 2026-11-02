'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { openSponsorDrawer } from '@/lib/drawer-store';
import { Plus, Search, Phone, MessageCircle, Mail, ChevronRight, UserRound, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import type { SpecialOccasion, Sponsor } from '@/lib/types';
import { formatCurrency } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { DeleteSponsorDialog } from '@/components/shared/DeleteSponsorDialog';
import { EVENT_LABELS, EVENT_TABS, byNext, eventsBySponsor, isEventTab, type EventTab, type SponsorEvent } from '@/lib/event-categories';
import { cn } from '@/lib/utils';

const dayMonth = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function SponsorsPage() {
  const { appUser } = useAuth();
  const [toDelete, setToDelete] = useState<Sponsor | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [occasions, setOccasions] = useState<SpecialOccasion[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [tab, setTab] = useState<EventTab>('all');
  const [loading, setLoading] = useState(true);

  // ?q= from the header search and ?event= for the selected tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setQuery(q);
    const event = params.get('event');
    if (isEventTab(event)) setTab(event);
  }, []);

  useEffect(() => {
    (async () => {
      const [s, o] = await Promise.all([
        supabase.from('sponsors').select('*').order('full_name'),
        supabase.from('special_occasions').select('*').eq('active', true),
      ]);
      setSponsors((s.data || []) as Sponsor[]);
      setOccasions((o.data || []) as SpecialOccasion[]);
      setLoading(false);
    })();
  }, []);

  function selectTab(next: EventTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete('event'); else url.searchParams.set('event', next);
    window.history.replaceState(window.history.state, '', url);
  }

  const events = useMemo(() => eventsBySponsor(occasions), [occasions]);

  // Status filter and search apply first; tabs then narrow by event.
  const base = sponsors.filter((s) => (filter === 'all' || s.status === filter)
    && (!query || [s.full_name, s.phone, s.whatsapp, s.email, s.sponsor_id].some((v) => v?.toLowerCase().includes(query.toLowerCase()))));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length };
    for (const s of base) {
      for (const category of new Set((events.get(s.id) || []).map((e) => e.category))) c[category] = (c[category] || 0) + 1;
    }
    return c;
  }, [base, events]);

  const rows: { sponsor: Sponsor; shown: SponsorEvent[] }[] = tab === 'all'
    ? base.map((s) => ({ sponsor: s, shown: events.get(s.id) || [] }))
    : base
      .map((s) => ({ sponsor: s, shown: (events.get(s.id) || []).filter((e) => e.category === tab) }))
      .filter((r) => r.shown.length > 0)
      .sort((a, b) => byNext(a.shown[0], b.shown[0]));

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Relationships</p>
            <h1 className="text-2xl font-semibold mt-1">Sponsors</h1>
            <p className="text-sm text-muted-foreground mt-1">Keep every important connection close.</p>
          </div>
          <Link href="/sponsors/new"><Button><Plus className="h-4 w-4 mr-2" />Add Sponsor</Button></Link>
        </div>

        <div className="-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto scrollbar-thin">
          <div className="flex gap-1 w-max lg:w-auto lg:flex-wrap pb-1">
            {EVENT_TABS.map((t) => (
              <Button key={t.key} variant={tab === t.key ? 'secondary' : 'ghost'} size="sm" className="whitespace-nowrap" onClick={() => selectTab(t.key)}>
                {t.label} <span className={cn('ml-1.5 rounded-full px-1.5 text-xs', tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{counts[t.key] || 0}</span>
              </Button>
            ))}
          </div>
        </div>

        <Card className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone, email or sponsor ID" className="pl-9" />
            </div>
            <div className="flex gap-1">
              {['active', 'archived', 'all'].map((f) => (
                <Button key={f} variant={filter === f ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
              ))}
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{rows.length} sponsors</p>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading sponsors...</div>
        ) : (
          <div className="grid gap-3">
            {rows.map(({ sponsor: s, shown }) => (
              <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <button type="button" aria-label={`Open ${s.full_name}`} onClick={() => openSponsorDrawer(s.id)} className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                    {s.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openSponsorDrawer(s.id)} className="font-semibold hover:text-primary truncate text-left">{s.full_name}</button>
                      {s.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{s.sponsor_id || 'Sponsor'} {s.city && `· ${s.city}`}</div>
                    {shown.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {shown.slice(0, 3).map((e) => (
                          <Badge key={e.occasion.id} variant="outline" className="text-xs font-normal">
                            {EVENT_LABELS[e.category]}{e.next ? ` · ${dayMonth(e.next)}` : ''}
                          </Badge>
                        ))}
                        {shown.length > 3 && <span className="text-xs text-muted-foreground">+{shown.length - 3} more</span>}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex gap-1">
                    {s.phone && <a href={`tel:${s.phone}`}><Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button></a>}
                    {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><Button variant="outline" size="icon"><MessageCircle className="h-4 w-4" /></Button></a>}
                    {s.email && <a href={`mailto:${s.email}`}><Button variant="outline" size="icon"><Mail className="h-4 w-4" /></Button></a>}
                  </div>
                  <div className="hidden md:block w-28 text-right">
                    <div className="font-semibold text-sm">{formatCurrency(Number(s.total_donations || 0))}</div>
                    <div className="text-xs text-muted-foreground">donated</div>
                  </div>
                  {appUser?.role === 'admin' && (
                    <Button variant="ghost" size="icon" aria-label={`Delete ${s.full_name}`} onClick={() => setToDelete(s)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Link href={`/sponsors/${s.id}`}><Button variant="ghost" size="icon"><ChevronRight className="h-5 w-5" /></Button></Link>
                </div>
              </Card>
            ))}
            {rows.length === 0 && (
              <Card className="py-14 text-center">
                <UserRound className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No sponsors found</h3>
                <p className="text-sm text-muted-foreground mt-1">Try a different tab or search, or add a new sponsor.</p>
              </Card>
            )}
          </div>
        )}
      </div>
      <DeleteSponsorDialog sponsor={toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }} onDeleted={(id) => setSponsors((prev) => prev.filter((x) => x.id !== id))} />
    </AppLayout>
  );
}
