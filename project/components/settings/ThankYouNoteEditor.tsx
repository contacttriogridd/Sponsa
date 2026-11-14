'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { organizationNamesFrom } from '@/lib/organization';
import {
  THANKS_LANGUAGE_OPTIONS, THANK_YOU_DEFAULTS, THANK_YOU_PLACEHOLDERS, fillKnown, thankYouData, thankYouTemplatesFrom, thanksLanguageChoice,
  type ThankYouLanguage, type ThanksLanguageChoice,
} from '@/lib/thank-you';
import type { OrganizationSettings } from '@/lib/types';

const SAMPLE_DONATION = { amount: 5000, donation_date: '2026-11-13', type: 'Money' };
const SAMPLE_SPONSOR = { full_name: 'Sathish', preferred_name: null };

/** "Thank-You Note": the English and Tamil messages sent from Send Thanks / Resend. */
export function ThankYouNoteEditor() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const [org, setOrg] = useState<OrganizationSettings | null>(null);
  const [templates, setTemplates] = useState<Record<ThankYouLanguage, string>>(THANK_YOU_DEFAULTS);
  const [language, setLanguage] = useState<ThankYouLanguage>('ta');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [defaultLanguage, setDefaultLanguage] = useState<ThanksLanguageChoice>('ta');
  const [languageStatus, setLanguageStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('organization_settings').select('*').limit(1).maybeSingle().then(({ data }) => {
      setOrg(data as OrganizationSettings | null);
      setTemplates(thankYouTemplatesFrom(data));
      setDefaultLanguage(thanksLanguageChoice(null, data?.thank_you_language));
    });
  }, []);

  const setText = (text: string) => { setTemplates((t) => ({ ...t, [language]: text })); setStatus(null); };

  /** Puts the placeholder where the cursor is (or over the selection). */
  function insert(placeholder: string) {
    const el = textarea.current;
    const current = templates[language];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setText(current.slice(0, start) + placeholder + current.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  /** Saves the default straight away; it also becomes the admin's own remembered choice. */
  async function saveDefaultLanguage(choice: ThanksLanguageChoice) {
    if (!org) return;
    const previous = defaultLanguage;
    setDefaultLanguage(choice);
    const { error } = await supabase.from('organization_settings').update({ thank_you_language: choice }).eq('id', org.id);
    if (error) {
      setDefaultLanguage(previous);
      setLanguageStatus({ ok: false, text: error.code === 'PGRST204' ? 'The default language needs database migration 00022 first.' : 'Unable to save. Please try again.' });
      return;
    }
    if (appUser) await supabase.from('app_users').update({ thank_you_language: choice }).eq('id', appUser.id);
    setLanguageStatus({ ok: true, text: 'Default language saved. Anyone who has already picked a language in Send Thanks keeps their last choice.' });
  }

  async function save() {
    if (!org) { setStatus({ ok: false, text: 'Organization settings not found. Save the main Settings page once first.' }); return; }
    if (!templates.en.trim() || !templates.ta.trim()) { setStatus({ ok: false, text: 'Both the English and Tamil messages are needed.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('organization_settings')
      .update({ thank_you_template_en: templates.en, thank_you_template_ta: templates.ta }).eq('id', org.id);
    setBusy(false);
    setStatus(error
      ? { ok: false, text: error.code === 'PGRST204' ? 'Saving the thank-you note needs database migration 00021 first.' : 'Unable to save. Please try again.' }
      : { ok: true, text: 'Thank-you note saved.' });
  }

  const preview = fillKnown(templates[language], thankYouData(SAMPLE_SPONSOR, SAMPLE_DONATION, organizationNamesFrom(org), language));

  return (
    <Card id="thank-you-note" className="p-5 space-y-4 scroll-mt-20">
      <div>
        <h2 className="font-semibold">Thank-You Note</h2>
        <p className="text-sm text-muted-foreground mt-1">Sent from Send Thanks / Resend on every donation (Money, Food and Monthly), with that donation&apos;s amount and date.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Default thank-you language</Label>
        <Select value={defaultLanguage} onValueChange={(v) => saveDefaultLanguage(v as ThanksLanguageChoice)} disabled={!isAdmin || !org}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {THANKS_LANGUAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.value === 'both' ? 'Both (தமிழ் + English)' : o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">&quot;Both&quot; sends the Tamil note, a divider, then the English note, built from the two templates below.</p>
        {languageStatus && <p className={languageStatus.ok ? 'text-xs text-success' : 'text-xs text-destructive'}>{languageStatus.text}</p>}
      </div>

      <Tabs value={language} onValueChange={(v) => setLanguage(v as ThankYouLanguage)}>
        <TabsList>
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="ta">தமிழ் Tamil</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-1.5">
        {THANK_YOU_PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={!isAdmin}
            onClick={() => insert(p)}
            className="px-2 py-1 rounded-md bg-muted text-xs font-mono hover:bg-primary/10 hover:text-primary disabled:opacity-50 disabled:pointer-events-none"
            title="Insert at the cursor"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="thank-you-note">{language === 'en' ? 'English message' : 'Tamil message'}</Label>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!isAdmin} onClick={() => setText(THANK_YOU_DEFAULTS[language])}>
            <RotateCcw className="h-3 w-3 mr-1" />Reset to default
          </Button>
        </div>
        <Textarea
          id="thank-you-note"
          ref={textarea}
          lang={language}
          value={templates[language]}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          disabled={!isAdmin}
          className="text-sm leading-relaxed"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Preview (sample: Sathish, ₹5,000, 13 Nov 2026)</Label>
        <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">{preview}</div>
      </div>

      {status && <p className={status.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{status.text}</p>}
      {isAdmin
        ? <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save Thank-You Note'}</Button>
        : <p className="text-xs text-muted-foreground">Only an admin can change the thank-you note.</p>}
    </Card>
  );
}
