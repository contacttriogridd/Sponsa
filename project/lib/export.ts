/**
 * Exports that open correctly in Excel and Google Sheets. Pure (no DOM, no
 * Supabase) so it can be tested; downloads live in lib/export-download.ts.
 *
 * CSV: UTF-8 with a BOM (Tamil stays readable), every field in double quotes
 * with "" for quotes inside, \r\n line endings, amounts as plain numbers (no ₹,
 * no commas) and dates as DD-MM-YYYY.
 */

import { normalizeDonationType } from '@/lib/constants';
import { thanksStatus } from '@/lib/messaging';
import { displayPhone, normalizePhone } from '@/lib/phone';
import type { Donation, MessageLog } from '@/lib/types';

export type Cell = string | number | Date | null | undefined;

/** "21-11-2026" from "2026-11-21" (or an ISO timestamp, in IST). */
export function ddmmyyyy(value: string | null | undefined): string {
  if (!value) return '';
  const date = value.length > 10 ? new Date(new Date(value).getTime() + 330 * 60 * 1000).toISOString().slice(0, 10) : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Amount as a plain number (no ₹, no commas). */
export function plainAmount(value: unknown): number {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function csvCell(v: Cell): string {
  if (v == null) return '""';
  const text = v instanceof Date ? ddmmyyyy(v.toISOString()) : typeof v === 'number' ? String(v) : String(v);
  return `"${text.replace(/"/g, '""')}"`;
}

/** The whole CSV text, BOM first. */
export function buildCsv(rows: Cell[][]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** A phone number for an export: +91 XXXXX XXXXX when valid, else as saved. */
export function exportPhone(value: string | null | undefined): string {
  return normalizePhone(value) ? displayPhone(value) : (value || '');
}

// ---------------------------------------------------------------- monthly donation report

export const REPORT_COLUMNS = ['S.No', 'Donation Date', 'Sponsor Name', 'Phone', 'Donation Type', 'Monthly Sponsor', 'Occasion / Note', 'Amount (₹)', 'Thanks Status', 'Thanks Sent On', 'Sent By'] as const;

export type ReportDonation = Donation & {
  sponsors?: { full_name?: string | null; phone?: string | null; whatsapp?: string | null } | null;
  monthly_sponsors?: { name?: string | null; phone?: string | null } | null;
};

export interface ReportRow {
  sno: number;
  /** YYYY-MM-DD, the donation date (not when the record was created). */
  date: string;
  name: string;
  phone: string;
  type: string;
  monthly: 'Yes' | 'No';
  note: string;
  amount: number;
  thanks: string;
  thanksOn: string;
  sentBy: string;
}

export interface MonthlyReport {
  month: string;
  monthLabel: string;
  title: string;
  subtitle: string;
  generated: string;
  rows: ReportRow[];
  total: number;
  count: number;
  money: number;
  food: number;
  summary: { name: string; phone: string; count: number; amount: number }[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const nameOf = (d: ReportDonation) => d.sponsors?.full_name || d.monthly_sponsors?.name || d.sponsor_name || 'Anonymous';
const phoneOf = (d: ReportDonation) => d.sponsors?.whatsapp || d.sponsors?.phone || d.monthly_sponsors?.phone || '';

/**
 * Every donation dated in `month` (YYYY-MM-01, by donation date — the same
 * filter as the Donations page), sorted by date then sponsor name, with the
 * totals and a per-sponsor summary.
 */
export function buildMonthlyReport(donations: ReportDonation[], logs: MessageLog[], month: string, generatedBy: string, now: Date = new Date()): MonthlyReport {
  const [y, m] = month.split('-').map(Number);
  const monthLabel = `${MONTHS[m - 1]} ${y}`;
  const inMonth = donations
    .filter((d) => d.donation_date?.slice(0, 7) === month.slice(0, 7))
    .sort((a, b) => a.donation_date.localeCompare(b.donation_date) || nameOf(a).localeCompare(nameOf(b)));

  const rows: ReportRow[] = inMonth.map((d, i) => {
    const t = thanksStatus(d, logs);
    return {
      sno: i + 1,
      date: d.donation_date.slice(0, 10),
      name: nameOf(d),
      phone: exportPhone(phoneOf(d)),
      type: normalizeDonationType(d.type),
      monthly: d.sponsor_type === 'monthly' || d.monthly_sponsor_id ? 'Yes' : 'No',
      note: [d.occasion_name, d.notes].filter(Boolean).join(' — '),
      amount: plainAmount(d.amount),
      thanks: t.sent ? 'Sent' : t.awaitingConfirm ? 'Opened (not confirmed)' : 'Pending',
      thanksOn: t.at ? ddmmyyyy(t.at) : '',
      sentBy: t.by || '',
    };
  });

  const byName = new Map<string, { name: string; phone: string; count: number; amount: number }>();
  for (const r of rows) {
    const key = `${r.name}|${r.phone}`;
    const s = byName.get(key) || { name: r.name, phone: r.phone, count: 0, amount: 0 };
    s.count++; s.amount += r.amount;
    byName.set(key, s);
  }
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const stamp = `${ddmmyyyy(ist.toISOString().slice(0, 10))} ${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')} IST`;

  return {
    month, monthLabel,
    title: 'VP TRUST – வள்ளலார் பசியாற்றும் அறக்கட்டளை',
    subtitle: `Monthly Donation Report – ${monthLabel}`,
    generated: `Generated on ${stamp} by ${generatedBy || 'VP TRUST'}`,
    rows,
    total: rows.reduce((a, r) => a + r.amount, 0),
    count: rows.length,
    money: rows.filter((r) => r.type === 'Money').reduce((a, r) => a + r.amount, 0),
    food: rows.filter((r) => r.type === 'Food').reduce((a, r) => a + r.amount, 0),
    summary: Array.from(byName.values()).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
  };
}

export const reportFileName = (month: string, ext: 'xlsx' | 'csv') => `VP-Trust-Donations-${month.slice(0, 4)}-${month.slice(5, 7)}.${ext}`;

/** The report as CSV rows: header lines, the table, totals (or the "no donations" line). */
export function monthlyReportCsvRows(r: MonthlyReport): Cell[][] {
  const out: Cell[][] = [[r.title], [r.subtitle], [r.generated], [], [...REPORT_COLUMNS]];
  if (!r.rows.length) { out.push(['No donations recorded for this month']); return out; }
  for (const x of r.rows) out.push([x.sno, ddmmyyyy(x.date), x.name, x.phone, x.type, x.monthly, x.note, x.amount, x.thanks, x.thanksOn, x.sentBy]);
  out.push([], ['', '', 'TOTAL', '', '', '', '', r.total], ['', '', 'Number of donations', '', '', '', '', r.count],
    ['', '', 'Subtotal – Money', '', '', '', '', r.money], ['', '', 'Subtotal – Food', '', '', '', '', r.food]);
  out.push([], ['Sponsor Summary'], ['Sponsor Name', 'Phone', 'Number of Donations', 'Total Amount (₹)']);
  for (const s of r.summary) out.push([s.name, s.phone, s.count, s.amount]);
  return out;
}
