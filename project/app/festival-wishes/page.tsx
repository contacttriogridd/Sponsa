'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, RotateCcw, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getTodayIST } from '@/lib/dateHelpers';
import {
  LANGUAGE_LABELS, buildFestivalMessage, festivalYear, joinNames,
  type Festival, type FestivalCategory, type FestivalLanguage, type FestivalTemplate,
} from '@/lib/festival';
import { logMessage, sendViaApi, subscribePending } from '@/lib/message-service';
import { formatSentAt } from '@/lib/messaging';
import { loadWishContext, type WishContext } from '@/lib/star-wish';
import { whatsappNumber } from '@/lib/phone';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { useDrawerDataChanged } from '@/lib/drawer-store';
import type { MessageLog } from '@/lib/types';

interface Recipient {
  id: string;
  category: FestivalCategory;
  name: string;
  phone: string | null;
  familyNames: string;
}

export default function FestivalWishesPage() {
  const { appUser } = useAuth();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [templates, setTemplates] = useState<FestivalTemplate[]>([]);
  const [general, setGeneral] = useState<Recipient[]>([]);
  const [monthly, setMonthly] = useState<Recipient[]>([]);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [ctx, setCtx] = useState<WishContext | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [festivalId, setFestivalId] = useState('');
  const [category, setCategory] = useState<FestivalCategory>('general');
  const [language, setLanguage] = useState<FestivalLanguage>('both');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<FestivalCategory, Set<string>>>({ general: new Set(), monthly: new Set() });
  const [drafts, setDrafts] = useState<{ en: string; ta: string }>({ en: '', ta: '' });
  const [confirmResend, setConfirmResend] = useState(false);
  const [queue, setQueue] = useState<Recipient[]>([]);
  const [position, setPosition] = useState(0);
  const [autoBusy, setAutoBusy] = useState(false);

  const year = festivalYear();
  const festival = festivals.find((f) => f.id === festivalId);

  const loadLogs = useCallback(async (key?: string) => {
    if (!key) return;
    const { data } = await supabase.from('message_logs').select('*').eq('festival_key', key).eq('festival_year', year);
    setLogs((data || []) as MessageLog[]);
  }, [year]);

  useEffect(() => {
    (async () => {
      const [f, t, s, m, fam] = await Promise.all([
        supabase.from('festivals').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('festival_templates').select('*'),
        supabase.from('sponsors').select('id, full_name, preferred_name, phone, whatsapp').eq('status', 'active').order('full_name'),
        supabase.from('monthly_sponsors').select('id, name, phone').eq('status', 'active').order('name'),
        supabase.from('monthly_family_members').select('monthly_sponsor_id, name').order('created_at'),
      ]);
      if (f.error || t.error) { setNotReady(true); return; }
      setFestivals((f.data || []) as Festival[]);
      setTemplates((t.data || []) as FestivalTemplate[]);
      setFestivalId((f.data || [])[0]?.id || '');
      setGeneral((s.data || []).map((x) => ({ id: x.id, category: 'general', name: x.preferred_name || x.full_name, phone: x.whatsapp || x.phone, familyNames: '' })));
      const families = new Map<string, string[]>();
      for (const x of fam.data || []) families.set(x.monthly_sponsor_id, [...(families.get(x.monthly_sponsor_id) || []), x.name]);
      setMonthly((m.error ? [] : m.data || []).map((x) => ({ id: x.id, category: 'monthly', name: x.name, phone: x.phone, familyNames: joinNames(families.get(x.id) || []) })));
      setCtx(await loadWishContext());
    })();
  }, []);

  useEffect(() => { loadLogs(festival?.key); }, [festival?.key, loadLogs]);
  // Refresh "Sent ✓" after a "Did you send?" answer.
  useEffect(() => subscribePending(() => loadLogs(festival?.key)), [festival?.key, loadLogs]);
  useDrawerDataChanged(useCallback(() => loadLogs(festival?.key), [festival?.key, loadLogs]));

  const templateFor = useCallback((lang: 'en' | 'ta') => templates.find((t) => t.festival_id === festivalId && t.category === category && t.language === lang), [templates, festivalId, category]);
  useEffect(() => {
    setDrafts({ en: templateFor('en')?.body || '', ta: templateFor('ta')?.body || '' });
  }, [templateFor]);

  const people = category === 'general' ? general : monthly;
  const visible = people.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.phone || '').includes(query));
  const chosen = selected[category];
  const chosenPeople = people.filter((p) => chosen.has(p.id));

  const lastLog = useMemo(() => {
    const map = new Map<string, MessageLog>();
    for (const l of [...logs].sort((a, b) => a.sent_at.localeCompare(b.sent_at))) {
      if (l.status === 'failed') continue;
      const id = l.sponsor_category === 'monthly' ? l.monthly_sponsor_id : l.sponsor_id;
      if (id) map.set(`${l.sponsor_category}:${id}`, l);
    }
    return map;
  }, [logs]);
  const statusOf = (p: Recipient) => lastLog.get(`${p.category}:${p.id}`);

  const messageFor = (p: Recipient) => (ctx ? buildFestivalMessage(language, drafts, { sponsor_name: p.name, family_member_names: p.familyNames }, ctx.organizationNames) : '');
  const previewPerson = chosenPeople[0] || visible[0];

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s[category]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...s, [category]: next };
    });
  }
  function toggleAll(on: boolean) {
    setSelected((s) => ({ ...s, [category]: on ? new Set([...Array.from(s[category]), ...visible.map((p) => p.id)]) : new Set() }));
  }

  async function saveTemplate(lang: 'en' | 'ta', reset = false) {
    const t = templateFor(lang);
    if (!t) return;
    const body = reset ? t.default_body : drafts[lang];
    const { error } = await supabase.from('festival_templates').update({ body, updated_at: new Date().toISOString() }).eq('id', t.id);
    if (error) { toast.error('Unable to save the template.'); return; }
    setTemplates((all) => all.map((x) => (x.id === t.id ? { ...x, body } : x)));
    if (reset) setDrafts((d) => ({ ...d, [lang]: body }));
    toast.success(reset ? 'Template reset to default' : 'Template saved');
  }

  function startSend() {
    if (chosenPeople.length === 0) return;
    if (chosenPeople.some((p) => statusOf(p))) { setConfirmResend(true); return; }
    begin();
  }
  function begin() {
    setQueue(chosenPeople);
    setPosition(0);
  }

  const logBase = (p: Recipient, text: string) => ({
    sponsorId: p.category === 'general' ? p.id : null,
    monthlySponsorId: p.category === 'monthly' ? p.id : null,
    sponsorName: p.name, sponsorPhone: p.phone,
    messageType: 'festival_wish' as const, typeLabel: `${festival?.name_en} Wish`,
    festivalKey: festival?.key, festivalYear: year, sponsorCategory: p.category, language,
    occurrenceDate: getTodayIST(), messageText: text, recipient: 'sponsor' as const, recipientPhone: whatsappNumber(p.phone),
    by: { id: appUser?.id, name: appUser?.full_name || appUser?.email },
  });

  async function sendAllAutomatic() {
    setAutoBusy(true);
    let failed = 0;
    for (let i = 0; i < queue.length; i += 1) {
      setPosition(i);
      const p = queue[i];
      const text = messageFor(p);
      const result = await sendViaApi(whatsappNumber(p.phone), text);
      if (!result.success) failed += 1;
      await logMessage({ ...logBase(p, text), channel: 'whatsapp_api', status: result.success ? 'sent' : 'failed', errorMessage: result.error, providerMessageId: result.messageId });
    }
    setAutoBusy(false);
    setPosition(queue.length);
    loadLogs(festival?.key);
    if (failed) toast.error(`${failed} could not be sent automatically. Switch to Manual mode in Settings to use WhatsApp links.`);
    else toast.success('All wishes sent');
  }

  const current = queue[position];
  const automatic = ctx?.messaging.sendMode === 'automatic';
  const sentCount = people.filter((p) => statusOf(p)?.status === 'sent' || statusOf(p)?.status === 'delivered').length;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">பண்டிகை வாழ்த்துகள்</p>
          <h1 className="text-2xl font-semibold mt-1">Festival Wishes</h1>
          <p className="text-sm text-muted-foreground mt-1">Send festival greetings to sponsors and monthly sponsors in Tamil, English or both.</p>
        </div>

        {notReady ? (
          <Card className="p-6 text-sm text-muted-foreground">Festival Wishes needs database migration 00019.</Card>
        ) : (
          <>
            <Card className="p-4 grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Festival</Label>
                <Select value={festivalId} onValueChange={setFestivalId}>
                  <SelectTrigger><SelectValue placeholder="Choose a festival" /></SelectTrigger>
                  <SelectContent>{festivals.map((f) => <SelectItem key={f.id} value={f.id}>{f.name_en} / {f.name_ta}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <div className="flex gap-1">
                  {(['ta', 'en', 'both'] as const).map((l) => (
                    <Button key={l} size="sm" variant={language === l ? 'secondary' : 'ghost'} onClick={() => setLanguage(l)}>{LANGUAGE_LABELS[l]}</Button>
                  ))}
                </div>
              </div>
            </Card>

            <Tabs value={category} onValueChange={(v) => { setCategory(v as FestivalCategory); setQuery(''); }}>
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="general">Sponsors (General) / நன்கொடையாளர்கள்</TabsTrigger>
                <TabsTrigger value="monthly">Monthly Sponsors / மாதாந்திர நன்கொடையாளர்கள்</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-5">
              <Card className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or phone" className="pl-9" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={visible.length > 0 && visible.every((p) => chosen.has(p.id))} onCheckedChange={(v) => toggleAll(v === true)} />
                    Select all
                  </label>
                  <span className="text-muted-foreground">{chosen.size} selected · {sentCount} of {people.length} sent</span>
                </div>
                <div className="divide-y divide-border max-h-[28rem] overflow-y-auto scrollbar-thin -mx-1">
                  {visible.map((p) => {
                    const log = statusOf(p);
                    return (
                      <label key={p.id} className="flex items-center gap-3 px-1 py-2.5 cursor-pointer">
                        <Checkbox checked={chosen.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{p.name}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {p.phone || 'No phone'}{p.familyNames ? ` · Family: ${p.familyNames}` : ''}
                          </span>
                        </span>
                        {log && (
                          <Badge variant="outline" className={log.status === 'opened' ? 'text-warning border-warning/40' : 'text-success border-success/30 bg-success/10'} title={formatSentAt(log.sent_at)}>
                            {log.status === 'opened' ? 'Opened' : 'Sent ✓'}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                  {visible.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No one found.</p>}
                </div>
                <Button className="w-full" disabled={chosen.size === 0 || !ctx || !festival} onClick={startSend}>
                  <MessageCircle className="h-4 w-4 mr-2" />Send to {chosen.size} selected
                </Button>
              </Card>

              <div className="space-y-5">
                <Card className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Template · {festival?.name_en} · {category === 'general' ? 'Sponsors' : 'Monthly Sponsors'}</h3>
                  {(language === 'both' ? (['ta', 'en'] as const) : [language]).map((lang) => (
                    <div key={lang} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>{lang === 'ta' ? 'Tamil' : 'English'}</Label>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => saveTemplate(lang, true)}><RotateCcw className="h-3 w-3 mr-1" />Reset to default</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => saveTemplate(lang)}><Save className="h-3 w-3 mr-1" />Save</Button>
                        </div>
                      </div>
                      <Textarea lang={lang} value={drafts[lang]} onChange={(e) => setDrafts((d) => ({ ...d, [lang]: e.target.value }))} rows={9} className="text-sm" />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Placeholders: {'{{sponsor_name}}'}, {'{{organization_name}}'} (VP TRUST in English, the Tamil name in Tamil){category === 'monthly' ? <>, {'{{family_member_names}}'} — its line is left out when there are no family members</> : null}.
                  </p>
                </Card>

                <Card className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm">Preview{previewPerson ? ` — ${previewPerson.name}` : ''}</h3>
                  {previewPerson ? (
                    <p className="text-sm whitespace-pre-line rounded-md bg-muted p-3">{messageFor(previewPerson)}</p>
                  ) : <p className="text-sm text-muted-foreground">Nobody to preview yet.</p>}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {queue.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 lg:bottom-0 z-40 p-4 flex justify-center pointer-events-none">
          <Card className="w-full max-w-lg p-4 shadow-xl pointer-events-auto space-y-3">
            {position < queue.length ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Sending {position + 1} of {queue.length}</span>
                  <Button size="sm" variant="ghost" onClick={() => setQueue([])} disabled={autoBusy}>Stop</Button>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${(position / queue.length) * 100}%` }} />
                </div>
                <div className="text-sm"><span className="font-medium">{current.name}</span> · {current.phone || 'No phone — WhatsApp will ask for the chat'}</div>
                {automatic ? (
                  <Button className="w-full" disabled={autoBusy} onClick={sendAllAutomatic}>{autoBusy ? 'Sending…' : `Send all ${queue.length} automatically`}</Button>
                ) : (
                  <div className="flex gap-2">
                    <a
                      className="flex-1"
                      href={buildWhatsAppUrl(whatsappNumber(current.phone), messageFor(current))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        const p = current;
                        logMessage({ ...logBase(p, messageFor(p)), channel: 'whatsapp_link', status: 'opened' }).then(() => loadLogs(festival?.key));
                        setTimeout(() => setPosition((i) => i + 1), 300);
                      }}
                    >
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white"><MessageCircle className="h-4 w-4 mr-2" />Open WhatsApp</Button>
                    </a>
                    <Button variant="outline" onClick={() => setPosition((i) => i + 1)}>Skip</Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span>Done — {queue.length} processed. Confirm each send when asked.</span>
                <Button size="sm" variant="outline" onClick={() => setQueue([])}>Close</Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmResend}
        onOpenChange={setConfirmResend}
        title="Send again?"
        description={`${chosenPeople.filter((p) => statusOf(p)).length} of the selected have already been sent this ${festival?.name_en} wish this year. Send to them again?`}
        confirmLabel="Send again"
        onConfirm={() => { setConfirmResend(false); begin(); }}
      />
    </AppLayout>
  );
}
