'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone, MessageCircle, Mail, Edit, ArrowLeft, Plus, Trash2,
  Gift, Users, CalendarDays, HandHeart, Archive, RotateCcw
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import type { Sponsor, FamilyMember, SpecialOccasion, Donation, Interaction, SponsorshipRequest } from '@/lib/types';
import { formatCurrency, formatDate, formatDateShort, OCCASION_ICONS, normalizeDonationType } from '@/lib/constants';
import { getNextOccurrence, daysUntil, getRelativeDayLabel } from '@/lib/date-utils';
import { SponsorForm } from '@/components/shared/SponsorForm';
import { FamilyMemberForm } from '@/components/shared/FamilyMemberForm';
import { OccasionForm } from '@/components/shared/OccasionForm';
import { DonationForm } from '@/components/shared/DonationForm';
import { SponsorshipForm } from '@/components/shared/SponsorshipForm';
import { Timeline } from '@/components/shared/Timeline';
import type { TimelineEvent } from '@/components/shared/Timeline';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

type DialogType = 'edit' | 'addFamily' | 'editFamily' | 'addOccasion' | 'editOccasion' | 'addDonation' | 'addSponsorship' | null;

export default function SponsorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [occasions, setOccasions] = useState<SpecialOccasion[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [requests, setRequests] = useState<SponsorshipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [editingFamily, setEditingFamily] = useState<FamilyMember | null>(null);
  const [editingOccasion, setEditingOccasion] = useState<SpecialOccasion | null>(null);

  const load = useCallback(async () => {
    const [s, f, o, d, i, r] = await Promise.all([
      supabase.from('sponsors').select('*').eq('id', id).single(),
      supabase.from('family_members').select('*').eq('sponsor_id', id).order('full_name'),
      supabase.from('special_occasions').select('*').eq('sponsor_id', id).order('occasion_date'),
      supabase.from('donations').select('*').eq('sponsor_id', id).order('donation_date', { ascending: false }),
      supabase.from('interactions').select('*').eq('sponsor_id', id).order('interaction_date', { ascending: false }),
      supabase.from('sponsorship_requests').select('*').eq('sponsor_id', id).order('created_at', { ascending: false }),
    ]);
    if (s.data) setSponsor(s.data as Sponsor);
    setFamily((f.data || []) as FamilyMember[]);
    setOccasions((o.data || []) as SpecialOccasion[]);
    setDonations((d.data || []) as Donation[]);
    setInteractions((i.data || []) as Interaction[]);
    setRequests((r.data || []) as SponsorshipRequest[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function archiveSponsor() {
    if (!sponsor) return;
    const newStatus = sponsor.status === 'active' ? 'archived' : 'active';
    await supabase.from('sponsors').update({ status: newStatus }).eq('id', id);
    setSponsor({ ...sponsor, status: newStatus });
  }

  async function deleteOccasion(occasionId: string) {
    await supabase.from('special_occasions').delete().eq('id', occasionId);
    setOccasions((prev) => prev.filter((o) => o.id !== occasionId));
  }

  async function deleteFamilyMember(memberId: string) {
    await supabase.from('family_members').delete().eq('id', memberId);
    setFamily((prev) => prev.filter((f) => f.id !== memberId));
    setOccasions((prev) => prev.filter((o) => o.family_member_id !== memberId));
  }

  const timelineEvents: TimelineEvent[] = [
    ...interactions.map((i) => ({
      id: i.id,
      type: (i.type === 'whatsapp' ? 'whatsapp' : i.type === 'call' ? 'call' : 'interaction') as TimelineEvent['type'],
      title: i.summary || 'Interaction',
      description: i.details || undefined,
      date: i.interaction_date,
    })),
    ...donations.map((d) => ({
      id: d.id,
      type: 'donation' as TimelineEvent['type'],
      title: `${normalizeDonationType(d.type)} donation${Number(d.amount) ? `: ${formatCurrency(Number(d.amount))}` : ''}`,
      description: `${[d.food_type, d.food_quantity].filter(Boolean).join(' · ') || normalizeDonationType(d.type)} for ${d.people_helped || 0} people${d.location ? ` · ${d.location}` : ''}`,
      date: d.created_at,
    })),
    ...requests.map((r) => ({
      id: r.id,
      type: 'sponsorship' as TimelineEvent['type'],
      title: `Sponsorship request — ${r.occasion_name || 'Occasion'}`,
      description: `Status: ${r.status}`,
      date: r.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const nextOccasion = occasions
    .filter((o) => o.active)
    .map((o) => {
      const next = getNextOccurrence(o.occasion_date, o.recurring_yearly);
      if (!next) return null;
      return { occasion: o, ...next, days: daysUntil(next.date) };
    })
    .filter(Boolean)
    .sort((a, b) => a!.days - b!.days)[0];

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!sponsor) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Sponsor not found.</p>
          <Link href="/sponsors"><Button variant="outline" className="mt-4">Back to Sponsors</Button></Link>
        </div>
      </AppLayout>
    );
  }

  const initials = sponsor.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

  return (
    <AppLayout>
      <div className="space-y-5 max-w-4xl">
        {/* Back */}
        <Link href="/sponsors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Sponsors
        </Link>

        {/* Header */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{sponsor.full_name}</h1>
                {sponsor.sponsor_id && <Badge variant="outline">{sponsor.sponsor_id}</Badge>}
                {sponsor.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
              </div>
              {sponsor.occupation && (
                <p className="text-sm text-muted-foreground mt-0.5">{sponsor.occupation}{sponsor.company ? ` · ${sponsor.company}` : ''}</p>
              )}
              {sponsor.city && (
                <p className="text-sm text-muted-foreground">{sponsor.city}{sponsor.state ? `, ${sponsor.state}` : ''}</p>
              )}
              {nextOccasion && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
                  <span>{OCCASION_ICONS[nextOccasion.occasion.occasion_type] || '⭐'}</span>
                  <span>{nextOccasion.occasion.occasion_type} · {getRelativeDayLabel(nextOccasion.days)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
              <div className="flex gap-2">
                {sponsor.phone && (
                  <a href={`tel:${sponsor.phone}`}><Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button></a>
                )}
                {sponsor.whatsapp && (
                  <a href={buildWhatsAppUrl(sponsor.whatsapp)} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="icon"><MessageCircle className="h-4 w-4" /></Button>
                  </a>
                )}
                {sponsor.email && (
                  <a href={`mailto:${sponsor.email}`}><Button variant="outline" size="icon"><Mail className="h-4 w-4" /></Button></a>
                )}
                <Button variant="outline" size="icon" onClick={() => setDialog('edit')}><Edit className="h-4 w-4" /></Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={archiveSponsor}
                className="text-muted-foreground"
              >
                {sponsor.status === 'active'
                  ? <><Archive className="h-4 w-4 mr-1.5" />Archive</>
                  : <><RotateCcw className="h-4 w-4 mr-1.5" />Restore</>
                }
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
            <div className="text-center">
              <div className="text-lg font-bold">{formatCurrency(Number(sponsor.total_donations || 0))}</div>
              <div className="text-xs text-muted-foreground">Total Donated</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{donations.length}</div>
              <div className="text-xs text-muted-foreground">Sponsorships</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{sponsor.people_helped || 0}</div>
              <div className="text-xs text-muted-foreground">People Helped</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{sponsor.last_contact_date ? formatDateShort(sponsor.last_contact_date) : '—'}</div>
              <div className="text-xs text-muted-foreground">Last Contact</div>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog('addSponsorship')}>
            <HandHeart className="h-4 w-4 mr-2" />Request Sponsorship
          </Button>
          <Button variant="outline" onClick={() => setDialog('addDonation')}>
            <Gift className="h-4 w-4 mr-2" />Record Donation
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="family">Family ({family.length})</TabsTrigger>
            <TabsTrigger value="occasions">Special Days ({occasions.length})</TabsTrigger>
            <TabsTrigger value="sponsorships">Sponsorships ({requests.length})</TabsTrigger>
            <TabsTrigger value="donations">Donations ({donations.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {sponsor.phone && <div><span className="text-muted-foreground">Phone: </span>{sponsor.phone}</div>}
                {sponsor.whatsapp && <div><span className="text-muted-foreground">WhatsApp: </span>{sponsor.whatsapp}</div>}
                {sponsor.email && <div><span className="text-muted-foreground">Email: </span>{sponsor.email}</div>}
                {sponsor.dob && <div><span className="text-muted-foreground">DOB: </span>{formatDate(sponsor.dob)}</div>}
                <div><span className="text-muted-foreground">WhatsApp Consent: </span>
                  <span className={sponsor.whatsapp_consent ? 'text-success' : 'text-destructive'}>
                    {sponsor.whatsapp_consent ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                {sponsor.communication_preference && (
                  <div><span className="text-muted-foreground">Preferred: </span><span className="capitalize">{sponsor.communication_preference}</span></div>
                )}
              </div>
            </Card>
            {(sponsor.address || sponsor.city) && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Address</h3>
                <p className="text-sm">{[sponsor.address, sponsor.city, sponsor.district, sponsor.state].filter(Boolean).join(', ')}</p>
              </Card>
            )}
            {sponsor.notes && (
              <Card className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
                <p className="text-sm whitespace-pre-wrap">{sponsor.notes}</p>
              </Card>
            )}
          </TabsContent>

          {/* Family */}
          <TabsContent value="family" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditingFamily(null); setDialog('addFamily'); }}>
                <Plus className="h-4 w-4 mr-1.5" />Add Family Member
              </Button>
            </div>
            {family.length === 0 ? (
              <Card className="py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No family members added yet.</p>
              </Card>
            ) : (
              family.map((m) => (
                <Card key={m.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium text-sm">
                      {m.full_name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-sm text-muted-foreground">{m.relationship}{m.dob ? ` · ${formatDate(m.dob)}` : ''}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingFamily(m); setDialog('editFamily'); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteFamilyMember(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Special Days */}
          <TabsContent value="occasions" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setEditingOccasion(null); setDialog('addOccasion'); }}>
                <Plus className="h-4 w-4 mr-1.5" />Add Occasion
              </Button>
            </div>
            {occasions.length === 0 ? (
              <Card className="py-10 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No special occasions added yet.</p>
              </Card>
            ) : (
              occasions.map((o) => {
                const next = getNextOccurrence(o.occasion_date, o.recurring_yearly);
                const days = next ? daysUntil(next.date) : null;
                return (
                  <Card key={o.id} className={`p-4 ${!o.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        {OCCASION_ICONS[o.occasion_type] || '⭐'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{o.person_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {o.occasion_type} · {formatDate(o.occasion_date)}
                          {days !== null && days >= 0 && days <= 30 && (
                            <span className="ml-2 text-primary font-medium">{getRelativeDayLabel(days)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {o.is_auto_generated && <Badge variant="outline" className="text-xs">Auto</Badge>}
                        {!o.active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                        <Button variant="ghost" size="icon" onClick={() => { setEditingOccasion(o); setDialog('editOccasion'); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteOccasion(o.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Sponsorships */}
          <TabsContent value="sponsorships" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDialog('addSponsorship')}>
                <Plus className="h-4 w-4 mr-1.5" />New Request
              </Button>
            </div>
            {requests.length === 0 ? (
              <Card className="py-10 text-center">
                <HandHeart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sponsorship requests yet.</p>
              </Card>
            ) : (
              requests.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{r.occasion_name || 'Sponsorship Request'}</div>
                      <div className="text-sm text-muted-foreground">
                        {r.special_date ? formatDate(r.special_date) : ''}
                        {r.food_type ? ` · ${r.food_type}` : ''}
                        {r.people_count ? ` · ${r.people_count} people` : ''}
                        {r.requested_amount ? ` · ${formatCurrency(Number(r.requested_amount))}` : ''}
                      </div>
                    </div>
                    <Badge variant={
                      r.status === 'completed' ? 'default' :
                      r.status === 'confirmed' ? 'default' :
                      r.status === 'declined' ? 'destructive' : 'secondary'
                    } className="capitalize">{r.status}</Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Donations */}
          <TabsContent value="donations" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setDialog('addDonation')}>
                <Plus className="h-4 w-4 mr-1.5" />Record Donation
              </Button>
            </div>
            {donations.length === 0 ? (
              <Card className="py-10 text-center">
                <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
              </Card>
            ) : (
              donations.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{d.occasion_name || 'Donation'}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(d.donation_date)}
                        {` · ${normalizeDonationType(d.type)}`}
                        {d.food_type ? ` · ${d.food_type}` : ''}
                        {d.people_helped ? ` · ${d.people_helped} people` : ''}
                        {d.location ? ` · ${d.location}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(Number(d.amount))}</div>
                      {d.donation_id && <div className="text-xs text-muted-foreground">{d.donation_id}</div>}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Timeline */}
          <TabsContent value="timeline" className="mt-4">
            <Card className="p-5">
              <Timeline events={timelineEvents} />
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Sponsor</DialogTitle></DialogHeader>
            <SponsorForm sponsor={sponsor} onSaved={(s) => { setSponsor(s); setDialog(null); }} />
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'addFamily' || dialog === 'editFamily'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{dialog === 'editFamily' ? 'Edit Family Member' : 'Add Family Member'}</DialogTitle></DialogHeader>
            <FamilyMemberForm
              sponsorId={id}
              member={editingFamily || undefined}
              onSaved={(m) => {
                setFamily((prev) => editingFamily ? prev.map((x) => x.id === m.id ? m : x) : [...prev, m]);
                setDialog(null);
                load();
              }}
              onCancel={() => setDialog(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'addOccasion' || dialog === 'editOccasion'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{dialog === 'editOccasion' ? 'Edit Occasion' : 'Add Special Occasion'}</DialogTitle></DialogHeader>
            <OccasionForm
              sponsorId={id}
              occasion={editingOccasion || undefined}
              defaultPersonName={sponsor.full_name}
              onSaved={(o) => {
                setOccasions((prev) => editingOccasion ? prev.map((x) => x.id === o.id ? o : x) : [...prev, o]);
                setDialog(null);
              }}
              onCancel={() => setDialog(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'addDonation'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Record Donation</DialogTitle></DialogHeader>
            <DonationForm
              sponsorId={id}
              sponsorName={sponsor.full_name}
              onSaved={(d) => { setDonations((prev) => [d, ...prev]); setDialog(null); load(); }}
              onCancel={() => setDialog(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'addSponsorship'} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Request Sponsorship</DialogTitle></DialogHeader>
            <SponsorshipForm
              sponsor={sponsor}
              occasion={occasions.find((o) => o.active) || undefined}
              onSaved={(r) => { setRequests((prev) => [r, ...prev]); setDialog(null); }}
              onCancel={() => setDialog(null)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
