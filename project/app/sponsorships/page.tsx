'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, HandHeart, Phone, MessageCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateShort, SPONSORSHIP_STATUS_LABELS } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

export default function SponsorshipsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sponsorship_requests')
        .select('*, sponsors(full_name, phone, whatsapp)')
        .order('created_at', { ascending: false });
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = items.filter((r) => {
    const matchFilter = filter === 'all' || r.status === filter;
    const matchQuery = !query || r.sponsors?.full_name?.toLowerCase().includes(query.toLowerCase()) || r.occasion_name?.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  const statusColor: Record<string, string> = {
    completed: 'bg-success/10 text-success',
    confirmed: 'bg-primary/10 text-primary',
    declined: 'bg-destructive/10 text-destructive',
    interested: 'bg-warning/10 text-warning',
    contacted: 'bg-blue-50 text-blue-600',
    pending: 'bg-muted text-muted-foreground',
    draft: 'bg-muted text-muted-foreground',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Food Sponsorship</p>
            <h1 className="text-2xl font-semibold mt-1">Sponsorships</h1>
            <p className="text-sm text-muted-foreground mt-1">Track every sponsorship request and its outcome.</p>
          </div>
          <Link href="/sponsorships/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Request</Button>
          </Link>
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
              {['all', 'pending', 'contacted', 'confirmed', 'completed', 'declined'].map((s) => (
                <Button
                  key={s}
                  variant={filter === s ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(s)}
                  className="capitalize"
                >
                  {s === 'all' ? 'All' : SPONSORSHIP_STATUS_LABELS[s] || s}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/sponsors/${r.sponsor_id}`} className="font-semibold hover:text-primary">
                        {r.sponsors?.full_name || 'Unknown'}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] || statusColor.draft}`}>
                        {SPONSORSHIP_STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {r.occasion_name || 'Occasion'}
                      {r.special_date ? ` · ${formatDateShort(r.special_date)}` : ''}
                      {r.food_type ? ` · ${r.food_type}` : ''}
                      {r.people_count ? ` · ${r.people_count} people` : ''}
                      {r.requested_amount ? ` · ${formatCurrency(Number(r.requested_amount))}` : ''}
                    </div>
                    {r.notes && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {r.sponsors?.phone && (
                      <a href={`tel:${r.sponsors.phone}`}>
                        <Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button>
                      </a>
                    )}
                    {r.sponsors?.whatsapp && (
                      <a href={buildWhatsAppUrl(r.sponsors.whatsapp)} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="icon"><MessageCircle className="h-4 w-4" /></Button>
                      </a>
                    )}
                    <Link href={`/sponsors/${r.sponsor_id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card className="py-14 text-center">
                <HandHeart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No sponsorship requests</h3>
                <p className="text-sm text-muted-foreground mt-1">Create a new request to get started.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
