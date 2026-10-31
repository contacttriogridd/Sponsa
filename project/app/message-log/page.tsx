'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/shared/DatePicker';
import { supabase } from '@/lib/supabase/client';
import { CHANNEL_LABELS, MESSAGE_TYPE_LABELS, formatDateLabel, formatSentAt } from '@/lib/messaging';
import { confirmMessage } from '@/lib/message-service';
import { useAuth } from '@/lib/auth-context';
import type { MessageLog, MessageType } from '@/lib/types';

const ALL = 'all';

export default function MessageLogPage() {
  const { appUser } = useAuth();
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState(ALL);
  const [employee, setEmployee] = useState(ALL);
  const [sponsor, setSponsor] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('message_logs').select('*').order('sent_at', { ascending: false }).limit(2000);
    if (error) setNotReady(true);
    setLogs((data || []) as MessageLog[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const employees = useMemo(() => Array.from(new Set(logs.map((l) => l.sent_by_name).filter(Boolean))) as string[], [logs]);

  const filtered = logs.filter((l) => {
    if (from && l.occurrence_date < from) return false;
    if (to && l.occurrence_date > to) return false;
    if (type !== ALL && l.message_type !== type) return false;
    if (employee !== ALL && l.sent_by_name !== employee) return false;
    const q = sponsor.trim().toLowerCase();
    return !q || (l.sponsor_name || '').toLowerCase().includes(q) || (l.sponsor_phone || '').includes(q);
  });

  function exportCsv() {
    const headers = ['sent_at', 'date_for', 'type', 'sponsor', 'sponsor_phone', 'recipient', 'recipient_phone', 'channel', 'status', 'sent_by', 'admin_notified', 'message'];
    const rows = filtered.map((l) => [
      formatSentAt(l.sent_at), l.occurrence_date, l.type_label || MESSAGE_TYPE_LABELS[l.message_type], l.sponsor_name, l.sponsor_phone,
      l.recipient, l.recipient_phone, CHANNEL_LABELS[l.channel], l.status, l.sent_by_name, l.admin_notified ? 'yes' : 'no', l.message_text,
    ].map((v) => JSON.stringify(v ?? '')).join(','));
    // Byte-order mark so Excel shows Tamil correctly.
    const url = URL.createObjectURL(new Blob(['﻿', [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'message-log.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const canWrite = appUser?.role === 'admin' || appUser?.role === 'collector';

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link href="/notifications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Notifications
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Record of every message</p>
            <h1 className="text-2xl font-semibold mt-1">Message Log</h1>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>

        <Card className="p-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1"><Label className="text-xs">From</Label><DatePicker value={from} onChange={setFrom} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><DatePicker value={to} onChange={setTo} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {(Object.keys(MESSAGE_TYPE_LABELS) as MessageType[]).map((t) => <SelectItem key={t} value={t}>{MESSAGE_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Employee</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {employees.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Sponsor</Label><Input value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Name or phone" /></div>
        </Card>

        {notReady && <Card className="p-6 text-sm text-muted-foreground">The Message Log needs database migration 00016.</Card>}
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">{filtered.length} messages</p>
            {filtered.map((l) => (
              <Card key={l.id} className="p-4">
                <button type="button" className="w-full text-left" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{l.sponsor_name || (l.recipient === 'admin' ? 'Admin' : 'Unknown')}</span>
                    <Badge variant="outline" className="text-xs">{l.type_label || MESSAGE_TYPE_LABELS[l.message_type]}</Badge>
                    <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[l.channel]}</Badge>
                    <Badge variant="outline" className={`text-xs capitalize ${l.status === 'failed' ? 'text-destructive border-destructive/40' : l.status === 'opened' ? 'text-warning border-warning/40' : 'text-success border-success/30'}`}>{l.status === 'opened' ? 'Not confirmed' : l.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {formatSentAt(l.sent_at)}{l.sent_by_name ? ` by ${l.sent_by_name}` : ''} · to {l.recipient === 'admin' ? 'admin' : 'sponsor'}{l.recipient_phone ? ` (+${l.recipient_phone})` : ''} · for {formatDateLabel(l.occurrence_date)}
                  </div>
                </button>
                {l.status === 'opened' && canWrite && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className="text-muted-foreground">Was it sent?</span>
                    <Button size="sm" variant="outline" className="h-7" onClick={async () => { await confirmMessage(l.id, true); load(); }}>Yes, sent</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={async () => { await confirmMessage(l.id, false); load(); }}>No</Button>
                  </div>
                )}
                {expanded === l.id && (
                  <p className="text-sm whitespace-pre-line mt-3 pt-3 border-t border-border">
                    {l.message_text}{l.error_message ? `\n\nError: ${l.error_message}` : ''}
                  </p>
                )}
              </Card>
            ))}
            {filtered.length === 0 && !notReady && <Card className="py-14 text-center text-muted-foreground">No messages match these filters.</Card>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
