'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_REQUEST, REQUEST_PLACEHOLDERS, buildRequestMessage } from '@/lib/monthly-request';
import { monthStart } from '@/lib/monthly-requests';
import { todayIst } from '@/lib/monthly-sponsors';
import { loadRequestContext, type RequestContext } from '@/lib/monthly-requests-store';

type Lang = 'en' | 'ta';
const TYPE = 'Monthly Sponsorship Request';
const NAMES: Record<Lang, string> = { en: 'Monthly Sponsorship Request (English)', ta: 'மாதாந்திர நன்கொடை கோரிக்கை (Tamil)' };

/** Settings → Message Templates → "Monthly Sponsorship Request", English and Tamil. */
export function MonthlyRequestTemplateEditor() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [ctx, setCtx] = useState<RequestContext | null>(null);
  const [bodies, setBodies] = useState<Record<Lang, string>>(DEFAULT_REQUEST);
  const [lang, setLang] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadRequestContext().then((c) => { setCtx(c); setBodies(c.templates); }); }, []);

  const setText = (text: string) => { setBodies((b) => ({ ...b, [lang]: text })); setStatus(null); };

  function insert(placeholder: string) {
    const el = textarea.current;
    const cur = bodies[lang];
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    setText(cur.slice(0, start) + placeholder + cur.slice(end));
    requestAnimationFrame(() => { if (!el) return; el.focus(); el.setSelectionRange(start + placeholder.length, start + placeholder.length); });
  }

  async function save() {
    if (!bodies.en.trim() || !bodies.ta.trim()) { setStatus({ ok: false, text: 'Both the English and Tamil messages are needed.' }); return; }
    setBusy(true);
    let failed = false;
    for (const l of ['en', 'ta'] as Lang[]) {
      const vars = (bodies[l].match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ''));
      const { data } = await supabase.from('message_templates').select('id').eq('type', TYPE).eq('language', l).limit(1);
      const row = { body: bodies[l], variables: vars, is_approved: true };
      const { error } = data?.length
        ? await supabase.from('message_templates').update(row).eq('id', data[0].id)
        : await supabase.from('message_templates').insert({ ...row, name: NAMES[l], type: TYPE, language: l });
      if (error) failed = true;
    }
    setBusy(false);
    setStatus(failed ? { ok: false, text: 'Unable to save. Please try again (needs migration 00028).' } : { ok: true, text: 'Monthly Sponsorship Request saved.' });
  }

  const sample = { name: 'Sathish', monthly_amount: 1100, payment_day: 5 };
  const preview = ctx ? buildRequestMessage(bodies, sample, monthStart(todayIst()), lang, ctx.org, ctx.pay) : '';

  return (
    <Card id="monthly-request" className="p-5 space-y-4 scroll-mt-20">
      <div>
        <h2 className="font-semibold">Monthly Sponsorship Request · மாதாந்திர நன்கொடை கோரிக்கை</h2>
        <p className="text-sm text-muted-foreground mt-1">Sent to monthly sponsors on the 1st–3rd of every month (Monthly Sponsors → Monthly requests). With no amount set, the amount is left out; with no payment details in Settings, the &quot;To donate&quot; line is left out.</p>
      </div>
      <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
        <TabsList>
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="ta">தமிழ் Tamil</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-1.5">
        {REQUEST_PLACEHOLDERS.map((p) => (
          <button key={p} type="button" disabled={!isAdmin} onClick={() => insert(p)} title="Insert at the cursor"
            className="px-2 py-1 rounded-md bg-muted text-xs font-mono hover:bg-primary/10 hover:text-primary disabled:opacity-50 disabled:pointer-events-none">{p}</button>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="monthly-request-body">{lang === 'en' ? 'English message' : 'Tamil message'}</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!isAdmin} onClick={() => setText(DEFAULT_REQUEST[lang])}>
            <RotateCcw className="h-3 w-3 mr-1" />Reset to default
          </Button>
        </div>
        <Textarea id="monthly-request-body" ref={textarea} lang={lang} value={bodies[lang]} onChange={(e) => setText(e.target.value)} rows={14} disabled={!isAdmin} className="text-sm leading-relaxed" />
      </div>
      <div className="space-y-1.5">
        <Label>Preview (sample: Sathish, ₹1,100, this month)</Label>
        <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">{preview}</div>
      </div>
      {status && <p className={status.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{status.text}</p>}
      {isAdmin
        ? <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save Monthly Sponsorship Request'}</Button>
        : <p className="text-xs text-muted-foreground">Only an admin can change this template.</p>}
    </Card>
  );
}
