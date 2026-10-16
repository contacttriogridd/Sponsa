'use client';

import { useEffect, useState } from 'react';
import { CalendarHeart, UserPlus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SponsorForm } from '@/components/shared/SponsorForm';
import { FamilyEventsManager } from '@/components/shared/FamilyEventsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Tab = 'sponsor' | 'events';

export default function NewSponsorPage() {
  const [tab, setTab] = useState<Tab>('sponsor');
  const [eventCount, setEventCount] = useState<number | null>(null);

  // `/sponsors/new?tab=events` opens straight onto Family Events. Read from
  // window rather than useSearchParams so the page needs no Suspense boundary.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'events') setTab('events');
  }, []);

  function changeTab(value: string) {
    const next = value as Tab;
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'events') url.searchParams.set('tab', 'events');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  }

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Sponsors</p>
          <h1 className="text-2xl font-semibold mt-1">Add New Sponsor</h1>
          <p className="text-base text-muted-foreground mt-1">
            {tab === 'sponsor'
              ? 'Start with a name and date of birth. Everything else can be added later.'
              : 'Keep track of your family’s birthdays, anniversaries and remembrance days.'}
          </p>
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="grid grid-cols-2 h-auto w-full sm:w-auto sm:inline-grid p-1">
            <TabsTrigger value="sponsor" className="h-11 text-base gap-2 px-4">
              <UserPlus className="h-5 w-5 shrink-0" />Sponsor Details
            </TabsTrigger>
            <TabsTrigger value="events" className="h-11 text-base gap-2 px-4">
              <CalendarHeart className="h-5 w-5 shrink-0" />
              <span>Family Events{eventCount ? ` (${eventCount})` : ''}</span>
            </TabsTrigger>
          </TabsList>

          {/* forceMount keeps the sponsor form's typed values when switching tabs. */}
          <TabsContent value="sponsor" forceMount className="mt-5 data-[state=inactive]:hidden">
            <div className="max-w-2xl">
              <SponsorForm />
            </div>
          </TabsContent>
          <TabsContent value="events" forceMount className="mt-5 data-[state=inactive]:hidden">
            <FamilyEventsManager onCountChange={setEventCount} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
