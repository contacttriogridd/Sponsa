'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import { messagingSettingsFrom, type SendMode } from '@/lib/messaging';
import { DEFAULT_REQUEST, requestDueDate, type PaymentDetails, type RequestLanguage } from '@/lib/monthly-request';
import { requestCounts, requestStatuses, inRequestWindow, monthStart, requestPhoneOf, type MonthlyRequestRow, type RequestSponsorLite, type RequestStatus } from '@/lib/monthly-requests';
import { logMessage } from '@/lib/message-service';
import { whatsappNumber } from '@/lib/phone';
import { notifyDrawerDataChanged, useDrawerDataChanged } from '@/lib/drawer-store';
import { todayIst } from '@/lib/monthly-sponsors';

export interface RequestContext {
  templates: { ta: string; en: string };
  org: OrganizationNames;
  pay: PaymentDetails;
  defaultLanguage: RequestLanguage;
  sendMode: SendMode;
}

/** Templates (saved, else the defaults), organization names, payment details and the default language. */
export async function loadRequestContext(): Promise<RequestContext> {
  const [{ data: rows }, { data: org }] = await Promise.all([
    supabase.from('message_templates').select('language, body, is_approved, updated_at').eq('type', 'Monthly Sponsorship Request').order('is_approved', { ascending: false }),
    supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
  ]);
  const pick = (l: 'ta' | 'en') => ((rows || []).find((r) => r.language === l)?.body as string | undefined) || DEFAULT_REQUEST[l];
  const lang = org?.thank_you_language;
  return {
    templates: { ta: pick('ta'), en: pick('en') },
    org: organizationNamesFrom(org),
    pay: { payment_details: org?.payment_details || '', upi_id: org?.upi_id || '', bank_details: org?.bank_details || '', contact_number: org?.phone || '' },
    defaultLanguage: lang === 'en' || lang === 'ta' || lang === 'both' ? lang : 'ta',
    sendMode: messagingSettingsFrom(org).sendMode,
  };
}

export type RequestSponsor = RequestSponsorLite & Record<string, unknown>;

/** Every active monthly sponsor with this month's request status. */
export async function loadMonthRequests(month: string): Promise<{ rows: RequestStatus<RequestSponsor>[]; ready: boolean }> {
  const [y, m] = month.split('-').map(Number);
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  const [{ data: sponsors }, { data: reqs, error }, { data: dons }] = await Promise.all([
    supabase.from('monthly_sponsors').select('*, sponsors(whatsapp, phone)').order('name'),
    supabase.from('monthly_sponsorship_requests').select('*').eq('year', y).eq('month', m),
    // Already donated: any donation recorded for the sponsor since the 1st.
    supabase.from('donations').select('monthly_sponsor_id').not('monthly_sponsor_id', 'is', null).gte('donation_date', monthStart(month)).lt('donation_date', next),
  ]);
  const donated = new Set((dons || []).map((d) => d.monthly_sponsor_id as string));
  return { rows: requestStatuses((sponsors || []) as RequestSponsor[], (error ? [] : reqs || []) as MonthlyRequestRow[], donated, month), ready: !error };
}

type By = { id?: string | null; name?: string | null };

/**
 * Opened in WhatsApp (or SMS): the month's row becomes "opened" unless it was
 * already sent. Logged like every message, so the Sponsorships record and the
 * D-x reminders follow too.
 */
export async function markRequestOpened(s: RequestSponsorLite, month: string, channel: 'whatsapp' | 'sms' | 'copy', language: RequestLanguage, message: string, by: By) {
  const [y, m] = month.split('-').map(Number);
  const { data: existing } = await supabase.from('monthly_sponsorship_requests').select('id, status, send_count').eq('monthly_sponsor_id', s.id).eq('year', y).eq('month', m).maybeSingle();
  const row = { channel, language, message, opened_at: new Date().toISOString(), send_count: (existing?.send_count || 0) + 1 };
  if (existing) await supabase.from('monthly_sponsorship_requests').update(row).eq('id', existing.id);
  else await supabase.from('monthly_sponsorship_requests').insert({ ...row, monthly_sponsor_id: s.id, year: y, month: m, status: 'opened' });
  if (channel !== 'copy') {
    const phone = requestPhoneOf(s);
    await logMessage({
      sponsorId: s.sponsor_id || null, sponsorName: s.name, sponsorPhone: phone, monthlySponsorId: s.id, sponsorCategory: 'monthly',
      messageType: 'sponsorship_request', typeLabel: `Monthly Sponsorship Request – ${month.slice(0, 7)}`, relatedEventId: `mspay:${s.id}`,
      occurrenceDate: requestDueDate(s, month), messageText: message, recipient: 'sponsor', recipientPhone: whatsappNumber(phone),
      channel: channel === 'sms' ? 'sms' : 'whatsapp_link', status: 'opened', language, by,
    });
  }
  notifyDrawerDataChanged();
}

/** "Mark sent": ✓ Request Sent · date, time by USERNAME. */
export async function markRequestSent(s: RequestSponsorLite, month: string, by: By, extra: { channel?: string; language?: RequestLanguage; message?: string } = {}): Promise<string | null> {
  const [y, m] = month.split('-').map(Number);
  const { error } = await supabase.from('monthly_sponsorship_requests').upsert({
    monthly_sponsor_id: s.id, year: y, month: m, status: 'sent', sent_at: new Date().toISOString(),
    sent_by: by.id || null, sent_by_name: by.name || null,
    ...(extra.channel ? { channel: extra.channel } : {}), ...(extra.language ? { language: extra.language } : {}), ...(extra.message ? { message: extra.message } : {}),
  }, { onConflict: 'monthly_sponsor_id,year,month' });
  notifyDrawerDataChanged();
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? 'Monthly requests need database migration 00031.' : error.message;
  return null;
}

let countCache: { key: string; at: number; value: { pending: number; sent: number; total: number } } | null = null;

/**
 * Pending / Sent for the current month during the 1st–3rd (null outside it),
 * for the Dashboard card and the Monthly Sponsors menu badge. Also posts the
 * in-app notification once a month.
 */
export function useMonthlyRequestCounts(enabled = true): { month: string; counts: { pending: number; sent: number; total: number } | null } {
  const today = todayIst();
  const month = monthStart(today);
  const active = enabled && inRequestWindow(today);
  const [counts, setCounts] = useState<{ pending: number; sent: number; total: number } | null>(countCache?.key === month ? countCache.value : null);

  const refresh = useCallback((force = false) => {
    if (!active) { setCounts(null); return; }
    if (!force && countCache?.key === month && Date.now() - countCache.at < 60_000) { setCounts(countCache.value); return; }
    loadMonthRequests(month).then(({ rows, ready }) => {
      if (!ready) return;
      const c = requestCounts(rows);
      const value = { pending: c.pending, sent: c.sent, total: c.total };
      countCache = { key: month, at: Date.now(), value };
      setCounts(value);
      // Once a month, for the whole team (dedupe_key is unique, migration 00031).
      supabase.from('notifications').upsert({
        type: 'monthly_requests', dedupe_key: `monthly-requests:${month.slice(0, 7)}`,
        title: 'Monthly sponsorship requests', message: `Monthly sponsorship requests are ready to send (${c.pending} sponsors)`,
      }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).then(() => undefined);
    }).catch(() => {});
  }, [active, month]);
  useEffect(() => { refresh(); }, [refresh]);
  const onChange = useCallback(() => refresh(true), [refresh]);
  useDrawerDataChanged(onChange);
  return { month, counts: active ? counts : null };
}
