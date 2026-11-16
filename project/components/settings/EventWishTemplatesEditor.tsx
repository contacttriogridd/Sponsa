'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OBSERVANCE_CHIP } from '@/components/monthly/ObservanceChip';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { OBSERVANCE_KEYS, OBSERVANCE_META, type ObservanceKey } from '@/lib/observances';
import {
  DEFAULT_EVENT_WISH_EN, DEFAULT_EVENT_WISH_TA, EVENT_WISH_PLACEHOLDERS, buildEventWishMessage, eventWishTemplatesFrom, type EventWishTemplate,
} from '@/lib/event-wishes';
import { loadEventWishContext } from '@/lib/event-wishes-store';
import { DEFAULT_ORGANIZATION_NAMES, type OrganizationNames } from '@/lib/organization';
import { cn } from '@/lib/utils';

type Lang = 'ta' | 'en';
const field = (lang: Lang): 'body_ta' | 'body_en' => (lang === 'ta' ? 'body_ta' : 'body_en');

/** "Event Wishes": one Tamil + English wish per monthly event, sent from Today's Event Wishes. */
export function EventWishTemplatesEditor() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [templates, setTemplates] = useState<Record<ObservanceKey, EventWishTemplate>>(() => eventWishTemplatesFrom(null));
  const [names, setNames] = useState<OrganizationNames>(DEFAULT_ORGANIZATION_NAMES);
  const [eventKey, setEventKey] = useState<ObservanceKey>('pournami');
  const [lang, setLang] = useState<Lang>('ta');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadEventWishContext().then((c) => { setTemplates(c.templates); setNames(c.organizationNames); }); }, []);

  const current = templates[eventKey][field(lang)];
  const setText = (text: string) => { setTemplates((t) => ({ ...t, [eventKey]: { ...t[eventKey], [field(lang)]: text } })); setStatus(null); };

  function insert(placeholder: string) {
    const el = textarea.current;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setText(current.slice(0, start) + placeholder + current.slice(end));
    requestAnimationFrame(() => { if (!el) return; el.focus(); el.setSelectionRange(start + placeholder.length, start + placeholder.length); });
  }

  async function save() {
    const t = templates[eventKey];
    if (!t.body_ta.trim() || !t.body_en.trim()) { setStatus({ ok: false, text: 'Both the Tamil and English messages are needed.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('event_wish_templates').upsert({ event_key: eventKey, body_ta: t.body_ta, body_en: t.body_en });
    setBusy(false);
    setStatus(error
      ? { ok: false, text: error.code === '42P01' || error.code === 'PGRST205' ? 'Event wish templates need database migration 00026 first.' : 'Unable to save. Please try again.' }
      : { ok: true, text: `${OBSERVANCE_META[eventKey].short} wish saved.` });
  }

  const sampleEvent = { event_key: eventKey, label: { ta: OBSERVANCE_META[eventKey].ta, en: OBSERVANCE_META[eventKey].en, icon: OBSERVANCE_META[eventKey].icon, paksha: null } };
  const preview = buildEventWishMessage(templates, 'Sathish', [sampleEvent], '2026-11-24', 1000, names);

  return (
    <Card id="event-wishes" className="p-5 space-y-4 scroll-mt-20">
      <div>
        <h2 className="font-semibold">Event Wishes · விசேஷ நாள் வாழ்த்து</h2>
        <p className="text-sm text-muted-foreground mt-1">Sent to monthly sponsors on their event days (Today&apos;s Event Wishes on the Monthly Sponsors page). The message is the Tamil text, then the English text. When a sponsor has two events on one day, the first event&apos;s template is used with both names and the amounts added up.</p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event">
        {OBSERVANCE_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={eventKey === k}
            onClick={() => { setEventKey(k); setStatus(null); }}
            className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs border', eventKey === k ? cn(OBSERVANCE_CHIP[k], 'border-transparent ring-2 ring-primary/40') : 'border-border hover:bg-muted')}
          >
            {OBSERVANCE_META[k].icon} {OBSERVANCE_META[k].ta} · {OBSERVANCE_META[k].short}
          </button>
        ))}
      </div>

      <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
        <TabsList>
          <TabsTrigger value="ta">தமிழ் Tamil</TabsTrigger>
          <TabsTrigger value="en">English</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-1.5">
        {EVENT_WISH_PLACEHOLDERS.map((p) => (
          <button key={p} type="button" disabled={!isAdmin} onClick={() => insert(p)} title="Insert at the cursor"
            className="px-2 py-1 rounded-md bg-muted text-xs font-mono hover:bg-primary/10 hover:text-primary disabled:opacity-50 disabled:pointer-events-none">
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="event-wish-body">{OBSERVANCE_META[eventKey].short} — {lang === 'ta' ? 'Tamil message' : 'English message'}</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!isAdmin} onClick={() => setText(lang === 'ta' ? DEFAULT_EVENT_WISH_TA : DEFAULT_EVENT_WISH_EN)}>
            <RotateCcw className="h-3 w-3 mr-1" />Reset to default
          </Button>
        </div>
        <Textarea id="event-wish-body" ref={textarea} lang={lang} value={current} onChange={(e) => setText(e.target.value)} rows={7} disabled={!isAdmin} className="text-sm leading-relaxed" />
      </div>

      <div className="space-y-1.5">
        <Label>Preview (sample: Sathish, ₹1,000, 24 Nov 2026)</Label>
        <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">{preview}</div>
      </div>

      {status && <p className={status.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{status.text}</p>}
      {isAdmin
        ? <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : `Save ${OBSERVANCE_META[eventKey].short} wish`}</Button>
        : <p className="text-xs text-muted-foreground">Only an admin can change the event wishes.</p>}
    </Card>
  );
}
