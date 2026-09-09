'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Edit, Save, X, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { TEMPLATE_TYPES } from '@/lib/constants';
import type { MessageTemplate } from '@/lib/types';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Birthday Wish', subject: '', body: '', is_approved: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('message_templates').select('*').order('type');
    setTemplates((data || []) as MessageTemplate[]);
  };

  useEffect(() => { load(); }, []);

  function openEdit(t: MessageTemplate) {
    setEditing(t);
    setForm({ name: t.name, type: t.type, subject: t.subject || '', body: t.body, is_approved: t.is_approved });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', type: 'Birthday Wish', subject: '', body: '', is_approved: false });
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.body) return;
    setBusy(true);
    const vars = (form.body.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/[{}]/g, ''));
    const payload = { ...form, variables: vars, subject: form.subject || null };
    if (editing) {
      await supabase.from('message_templates').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('message_templates').insert(payload);
    }
    setBusy(false);
    setShowForm(false);
    load();
  }

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const VARIABLES = ['{{sponsor_name}}', '{{person_name}}', '{{occasion}}', '{{organization_name}}', '{{date}}'];

  return (
    <AppLayout>
      <div className="max-w-3xl space-y-5">
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Settings</p>
            <h1 className="text-2xl font-semibold mt-1">Message Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage templates for birthday wishes, sponsorship requests, and more.</p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Template</Button>
        </div>

        <div className="p-3 rounded-lg bg-muted text-sm">
          <span className="font-medium">Available variables: </span>
          {VARIABLES.map((v) => (
            <code key={v} className="mx-1 px-1.5 py-0.5 bg-background rounded text-xs">{v}</code>
          ))}
        </div>

        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{t.name}</span>
                    <Badge variant="outline" className="text-xs">{t.type}</Badge>
                    {t.is_approved && (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3 w-3" />Approved
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                  {t.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variables.map((v) => (
                        <code key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Template' : 'New Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Template Name</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Birthday Wish" />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => set('type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Subject (optional)</Label>
                  <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Email subject line" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Message Body</Label>
                  <Textarea value={form.body} onChange={(e) => set('body', e.target.value)} rows={8} placeholder="Use {{sponsor_name}}, {{organization_name}}, etc." className="font-mono text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="approved" checked={form.is_approved} onCheckedChange={(v) => set('is_approved', v)} />
                <Label htmlFor="approved" className="cursor-pointer">Mark as approved (for auto-sending)</Label>
              </div>
              <div className="flex gap-3">
                <Button onClick={save} disabled={busy}>
                  <Save className="h-4 w-4 mr-2" />{busy ? 'Saving...' : 'Save Template'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}><X className="h-4 w-4 mr-2" />Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
