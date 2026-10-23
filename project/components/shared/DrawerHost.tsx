'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sheet } from '@/components/ui/sheet';
import dynamic from 'next/dynamic';

// Loaded on first open so every page doesn't carry the drawers' code.
const SponsorDetailDrawer = dynamic(() => import('@/components/shared/SponsorDetailDrawer').then((m) => m.SponsorDetailDrawer), { ssr: false });
const MonthlySponsorDetailDrawer = dynamic(() => import('@/components/monthly/MonthlySponsorDetailDrawer').then((m) => m.MonthlySponsorDetailDrawer), { ssr: false });
import { closeDrawer, syncDrawerFromUrl, useDrawerState } from '@/lib/drawer-store';

/** Renders the sponsor / monthly sponsor detail drawer for every page (mounted in AppLayout). */
export function DrawerHost() {
  const state = useDrawerState();
  const pathname = usePathname();

  // Open from ?sponsor= / ?monthly= on load and after navigation; follow back/forward.
  useEffect(() => { syncDrawerFromUrl(); }, [pathname]);
  useEffect(() => {
    window.addEventListener('popstate', syncDrawerFromUrl);
    return () => window.removeEventListener('popstate', syncDrawerFromUrl);
  }, []);

  return (
    <Sheet open={!!state} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
      {state?.kind === 'sponsor' && (
        <SponsorDetailDrawer key={`${state.id}-${state.occasionId || ''}`} sponsorId={state.id} occasionId={state.occasionId} open />
      )}
      {state?.kind === 'monthly' && <MonthlySponsorDetailDrawer key={state.id} monthlyId={state.id} />}
    </Sheet>
  );
}
