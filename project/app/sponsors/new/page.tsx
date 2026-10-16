'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { SponsorForm } from '@/components/shared/SponsorForm';

export default function NewSponsorPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Sponsors</p>
          <h1 className="text-2xl font-semibold mt-1">Add New Sponsor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Start with a name and date of birth. Everything else can be added later.
          </p>
        </div>
        <SponsorForm />
      </div>
    </AppLayout>
  );
}
