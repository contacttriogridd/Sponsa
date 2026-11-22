'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, HandHeart, Phone, MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDateShort, normalizeDonationType, SPONSORSHIP_STATUS_LABELS } from '@/lib/constants';
import { formatSentAt, CHANNEL_LABELS } from '@/lib/messaging';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { DeleteRecordDialog, type DeletableRecord } from '@/components/shared/DeleteRecordDialog';
import { openMonthlySponsorDrawer, useDrawerDataChanged } from '@/lib/drawer-store';
import { useAuth } from '@/lib/auth-context';
import type { MessageLog } from '@/lib/types';
import { PhoneLink } from '@/components/shared/PhoneLink';
import { buildCallLink } from '@/lib/phone';

/** The request flow; older statuses are still shown and kept. */
const FLOW = ['requested', 'confirmed', 'paid', 'declined', 'no_response'];
const FILTERS = ['all', ...FLOW, 'completed'];

const statusColor: Record<string, string> = {
  requested: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100',
  paid: 'bg-success/10 text-success',
  completed: 'bg-success/10 text-success',
  confirmed: 'bg-primary/10 text-primary',
  declined: 'bg-destructive/10 text-destructive',
  no_response: 'bg-muted text-muted-foreground',
  interested: 'bg-warning/10 text-warning',
  contacted: 'bg-blue-50 text-blue-600',
  pending: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function SponsorshipsPage() {
  const { appUser } = useAuth();
  const [deleting, setDeleting] = useState<DeletableRecord | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const full = await supabase
      .from('sponsorship_requests')
      .select('*, sponsors(full_name, phone, whatsapp), monthly_sponsors(id, name, phone), donations!sponsorship_requests_donation_id_fkey(amount, receipt_number)')
      .order('created_at', { ascending: false });
    // Before migration 00028 there is no monthly sponsor or donation link to join.
    const data = full.error
      ? (await supabase.from('sponsorship_requests').select('*, sponsors(full_name, phone, whatsapp)').order('created_at', { ascending: false })).data
      : full.data;
    setItems(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useDrawerDataChanged(load);

  const nameOf = (r: any) => r.sponsors?.full_name || r.monthly_sponsors?.name || 'Unknown';
  const filtered = items.filter((r) => {
    const matchFilter = filter === 'all' || r.status === filter;
    const q = query.toLowerCase();
    const matchQuery = !q || nameOf(r).toLowerCase().includes(q) || r.occasion_name?.toLowerCase().includes(q);
    return matchFilter && matchQuery;
  });

  async function setStatus(r: any, status: string) {
    const { error } = await supabase.from('sponsorship_requests').update({ status }).eq('id', r.id);
    if (error) { toast.error(error.message.includes('check') ? 'This status needs database migration 00028.' : 'Unable to change the status.'); return; }
    setItems((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Sponsorship Requests</p>
            <h1 className="text-2xl font-semibold mt-1">Sponsorships</h1>
            <p className="text-sm text-muted-foreground mt-1">Requested → Confirmed → Paid. A request sent to a sponsor is added here automatically; recording their donation marks it Paid.</p>
          </div>
          <Link href="/sponsorships/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Request</Button>
          </Link>
        </div>

        <Card className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by sponsor or occasion..." className="flex-1" />
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((s) => (
                <Button key={s} variant={filter === s ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter(s)}>
                  {s === 'all' ? 'All' : SPONSORSHIP_STATUS_LABELS[s] || s}
                  {s !== 'all' && <span className="ml-1 text-muted-foreground">{items.filter((r) => r.status === s).length}</span>}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => {
              const phone = r.sponsors?.whatsapp || r.sponsors?.phone || r.monthly_sponsors?.phone;
              const statuses = FLOW.includes(r.status) ? FLOW : [...FLOW, r.status];
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.monthly_sponsors ? (
                          <button type="button" onClick={() => openMonthlySponsorDrawer(r.monthly_sponsors.id)} className="font-semibold hover:text-primary text-left">{nameOf(r)}</button>
                        ) : (
                          <Link href={`/sponsors/${r.sponsor_id}`} className="font-semibold hover:text-primary">{nameOf(r)}</Link>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] || statusColor.draft}`}>
                          {SPONSORSHIP_STATUS_LABELS[r.status] || r.status}
                        </span>
                        {r.category && <Badge variant="secondary" className="text-xs font-normal">{r.category}</Badge>}
                        {r.source_log_id && <Badge variant="outline" className="text-xs font-normal">Auto</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {r.type ? `${normalizeDonationType(r.type)} · ` : ''}{r.occasion_name || 'Occasion'}
                        {r.special_date ? ` · ${formatDateShort(r.special_date)}` : ''}
                        {r.food_type ? ` · ${r.food_type}` : ''}
                        {r.people_count ? ` · ${r.people_count} people` : ''}
                        {r.requested_amount ? ` · ${formatCurrency(Number(r.requested_amount))}` : ''}
                      </div>
                      {(r.request_sent_at || r.donations) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.request_sent_at && <>Requested {formatSentAt(r.request_sent_at)}{r.channel ? ` via ${CHANNEL_LABELS[r.channel as MessageLog['channel']] || r.channel}` : ''}</>}
                          {r.donations && <span className="text-success">{r.request_sent_at ? ' · ' : ''}Paid {formatCurrency(Number(r.donations.amount))}{r.donations.receipt_number ? ` (${r.donations.receipt_number})` : ''}</span>}
                        </div>
                      )}
                      {r.notes && !r.source_log_id && <div className="text-xs text-muted-foreground mt-1">{r.notes}</div>}
                    </div>
                    <div className="flex gap-2 shrink-0 items-center flex-wrap">
                      <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                        <SelectTrigger className="h-9 w-36" aria-label="Status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => <SelectItem key={s} value={s}>{SPONSORSHIP_STATUS_LABELS[s] || s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {phone && (
                        <PhoneLink href={buildCallLink(phone)} editHref={r.sponsor_id ? `/sponsors/${r.sponsor_id}` : null} onEdit={r.monthly_sponsors ? () => openMonthlySponsorDrawer(r.monthly_sponsors.id) : null}>
                          <Button variant="outline" size="icon" aria-label="Call"><Phone className="h-4 w-4" /></Button>
                        </PhoneLink>
                      )}
                      {phone && (
                        <PhoneLink href={buildWhatsAppUrl(phone)} newTab editHref={r.sponsor_id ? `/sponsors/${r.sponsor_id}` : null} onEdit={r.monthly_sponsors ? () => openMonthlySponsorDrawer(r.monthly_sponsors.id) : null}>
                          <Button variant="outline" size="icon" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
                        </PhoneLink>
                      )}
                      {r.sponsor_id && <Link href={`/sponsors/${r.sponsor_id}`}><Button variant="outline" size="sm">View</Button></Link>}
                      {appUser?.role === 'admin' && (
                        <Button variant="outline" size="icon" className="text-destructive" aria-label="Delete sponsorship request"
                          onClick={() => setDeleting({ kind: 'sponsorship', id: r.id, label: `${nameOf(r)} — request for ${r.occasion_name || 'occasion'}` })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <Card className="py-14 text-center">
                <HandHeart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No sponsorship requests</h3>
                <p className="text-sm text-muted-foreground mt-1">Requests appear here when you send them, or create one with New Request.</p>
              </Card>
            )}
          </div>
        )}
      </div>
      <DeleteRecordDialog
        record={deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onDeleted={(rec) => setItems((prev) => prev.filter((x) => x.id !== rec.id))}
      />
    </AppLayout>
  );
}
