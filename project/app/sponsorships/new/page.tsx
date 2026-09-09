'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { SponsorshipForm } from '@/components/shared/SponsorshipForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import type { Sponsor, SpecialOccasion } from '@/lib/types';

export default function NewSponsorshipPage() {
  const router = useRouter();
  const params = useSearchParams();
  const preloadSponsorId = params.get('sponsor');
  const preloadOccasionId = params.get('occasion');

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [occasions, setOccasions] = useState<SpecialOccasion[]>([]);
  const [selectedSponsorId, setSelectedSponsorId] = useState(preloadSponsorId || '');
  const [selectedOccasionId, setSelectedOccasionId] = useState(preloadOccasionId || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sponsors').select('*').eq('status', 'active').order('full_name');
      setSponsors((data || []) as Sponsor[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSponsorId) { setOccasions([]); return; }
    (async () => {
      const { data } = await supabase
        .from('special_occasions')
        .select('*')
        .eq('sponsor_id', selectedSponsorId)
        .eq('active', true)
        .order('occasion_date');
      setOccasions((data || []) as SpecialOccasion[]);
    })();
  }, [selectedSponsorId]);

  const selectedSponsor = sponsors.find((s) => s.id === selectedSponsorId);
  const selectedOccasion = occasions.find((o) => o.id === selectedOccasionId);

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Sponsorships</p>
          <h1 className="text-2xl font-semibold mt-1">New Sponsorship Request</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a sponsor and occasion to create a request.</p>
        </div>

        {!preloadSponsorId && (
          <Card className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Select Sponsor</Label>
              <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                <SelectTrigger>
                  <SelectValue placeholder={loading ? 'Loading...' : 'Choose a sponsor'} />
                </SelectTrigger>
                <SelectContent>
                  {sponsors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSponsorId && occasions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Select Occasion (optional)</Label>
                <Select value={selectedOccasionId} onValueChange={setSelectedOccasionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {occasions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.occasion_type} — {o.person_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </Card>
        )}

        {selectedSponsor && (
          <SponsorshipForm
            sponsor={selectedSponsor}
            occasion={selectedOccasion}
            onSaved={() => router.push('/sponsorships')}
            onCancel={() => router.back()}
          />
        )}
      </div>
    </AppLayout>
  );
}
