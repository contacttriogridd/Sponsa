'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { parseObservancesCsv, type CsvRowError } from '@/lib/observances';
import { countObservances, importObservances } from '@/lib/observances-store';
import { formatStarDate } from '@/lib/monthly-sponsors';

interface Summary { file: string; added: number; skipped: number; errors: CsvRowError[]; failed: string | null }

/** Settings → Calendar: the observance dates on the Star Calendar, and importing more. */
export default function CalendarSettingsPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [stats, setStats] = useState<Awaited<ReturnType<typeof countObservances>> | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => countObservances().then(setStats);
  useEffect(() => { refresh(); }, []);

  async function onFile(file: File) {
    setSummary(null);
    setBusy('Reading file…');
    // file.text() decodes as UTF-8, so the Tamil names stay intact; the parser strips the BOM.
    const parsed = parseObservancesCsv(await file.text());
    if (!parsed.rows.length) {
      setBusy(null);
      setSummary({ file: file.name, added: 0, skipped: parsed.duplicates, errors: parsed.errors.length ? parsed.errors : [{ row: 1, message: 'No rows found' }], failed: null });
      return;
    }
    const result = await importObservances(parsed.rows, (done) => setBusy(`Importing… ${done} of ${parsed.rows.length}`));
    setBusy(null);
    setSummary({ file: file.name, added: result.added, skipped: result.skipped + parsed.duplicates, errors: parsed.errors, failed: result.error });
    refresh();
  }

  return (
    <AppLayout>
      <div className="space-y-5 max-w-3xl">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly observances (Amavasai, Pournami, Ekadashi, Pradosham, Sankatahara Chaturthi, Sashti, Maadha Shivaratri) on the Star Calendar.</p>
        </div>

        <Card className="p-5 space-y-2">
          <h2 className="font-semibold">Loaded dates</h2>
          {stats === undefined && <p className="text-sm text-muted-foreground">Loading…</p>}
          {stats === null && <p className="text-sm text-destructive">The observances table is missing. Run database migration 00025 first.</p>}
          {stats && stats.total === 0 && <p className="text-sm text-muted-foreground">No observance dates yet.</p>}
          {stats && stats.total > 0 && (
            <p className="text-sm">{stats.total.toLocaleString('en-IN')} events, from {formatStarDate(stats.first!)} to {formatStarDate(stats.last!)}.</p>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Import observances CSV</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A UTF-8 CSV with the columns <span className="font-mono text-xs">date,day,event_en,event_ta</span>, e.g.{' '}
              <span className="font-mono text-xs">2036-11-15,Sat,Sashti,சஷ்டி</span>. event_en is one of Amavasai, Pournami, Ekadashi,
              Pradosham, Sankatahara Chaturthi, Sashti, Maadha Shivaratri. Events already loaded for the same date are skipped, and
              dates an admin moved, hid or noted are never changed.
            </p>
          </div>
          {isAdmin ? (
            <>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }}
              />
              <Button onClick={() => input.current?.click()} disabled={!!busy || stats === null}>
                <Upload className="h-4 w-4 mr-2" />{busy || 'Choose CSV file'}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Only an admin can import observances.</p>
          )}

          {summary && (
            <div className="rounded-md border border-border p-3 space-y-2 text-sm">
              <div className="font-medium">{summary.file}</div>
              <div><span className="text-success font-semibold">{summary.added} added</span> · {summary.skipped} skipped (already loaded) · <span className={summary.errors.length ? 'text-destructive' : ''}>{summary.errors.length} errors</span></div>
              {summary.failed && <p className="text-destructive">Import stopped: {summary.failed}</p>}
              {summary.errors.length > 0 && (
                <ul className="max-h-48 overflow-y-auto text-xs text-destructive space-y-0.5">
                  {summary.errors.map((e) => <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
