'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DonationForm } from '@/components/shared/DonationForm';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate, normalizeDonationType } from '@/lib/constants';
import type { Sponsor } from '@/lib/types';

export default function DonationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');

  const load = async () => {
    const [d, s] = await Promise.all([
      supabase.from('donations').select('*, sponsors(full_name)').order('donation_date', { ascending: false }),
      supabase.from('sponsors').select('id,full_name').eq('status', 'active').order('full_name'),
    ]);
    setItems(d.data || []);
    setSponsors((s.data || []) as Sponsor[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const now = new Date();
  const filtered = items.filter((d) => {
    const date = new Date(d.donation_date);
    const matchFilter =
      filter === 'all' ||
      (filter === 'today' && date.toDateString() === now.toDateString()) ||
      (filter === 'week' && (now.getTime() - date.getTime()) < 7 * 86400000) ||
      (filter === 'month' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) ||
      (filter === 'year' && date.getFullYear() === now.getFullYear());
    const matchQuery = !query || d.sponsors?.full_name?.toLowerCase().includes(query.toLowerCase()) || d.occasion_name?.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  const total = filtered.reduce((a, d) => a + Number(d.amount || 0), 0);
  const people = filtered.reduce((a, d) => a + Number(d.people_helped || 0), 0);

  const selectedSponsor = sponsors.find((s) => s.id === selectedSponsorId);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Impact</p>
            <h1 className="text-2xl font-semibold mt-1">Donations</h1>
            <p className="text-sm text-muted-foreground mt-1">Every contribution recorded and accounted for.</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />Record Donation
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <div className="text-xl font-bold">{formatCurrency(total)}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Amount</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xl font-bold">{people.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">People Helped</div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by sponsor or occasion..."
              className="flex-1"
            />
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'year', label: 'This Year' },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={filter === f.key ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                      <Gift className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link href={`/sponsors/${d.sponsor_id}`} className="font-semibold hover:text-primary">
                          {d.sponsors?.full_name || 'Unknown'}
                        </Link>
                        <Badge variant="outline" className="text-xs">{normalizeDonationType(d.type)}</Badge>
                        {d.food_type && <Badge variant="outline" className="text-xs">{d.food_type}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(d.donation_date)}
                        {d.occasion_name ? ` · ${d.occasion_name}` : ''}
                        {d.people_helped ? ` · ${d.people_helped} people` : ''}
                        {d.location ? ` · ${d.location}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-success">{formatCurrency(Number(d.amount))}</div>
                    {d.donation_id && <div className="text-xs text-muted-foreground">{d.donation_id}</div>}
                  </div>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="py-14 text-center">
                <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No donations recorded yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Record your first donation to get started.</p>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Quick record dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Select Sponsor</label>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
                value={selectedSponsorId}
                onChange={(e) => setSelectedSponsorId(e.target.value)}
              >
                <option value="">Choose a sponsor...</option>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            {selectedSponsor && (
              <DonationForm
                sponsorId={selectedSponsorId}
                sponsorName={selectedSponsor.full_name}
                onSaved={() => { setShowForm(false); setSelectedSponsorId(''); load(); }}
                onCancel={() => { setShowForm(false); setSelectedSponsorId(''); }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
