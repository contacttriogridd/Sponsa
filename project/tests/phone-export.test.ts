import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCallLink, buildSmsLink, buildWhatsAppLink, displayPhone, normalizeIndianNumber, normalizePhone, phoneProblem, toE164, whatsappNumber,
} from '@/lib/phone';
import { buildSmsUrl } from '@/lib/thank-you';
import { findPhoneIssues } from '@/lib/numbers-to-fix';
import { buildCsv, buildMonthlyReport, ddmmyyyy, monthlyReportCsvRows, plainAmount, reportFileName, type ReportDonation } from '@/lib/export';
import { monthlyReportXlsx } from '@/lib/export-xlsx';
import type { MessageLog } from '@/lib/types';

const OK = { e164: '+919876543210', waDigits: '919876543210', display: '+91 98765 43210' };

test('normalizePhone: every way an Indian mobile is written', () => {
  assert.deepEqual(normalizePhone('9876543210'), OK); // plain 10 digits
  assert.deepEqual(normalizePhone('09876543210'), OK); // leading 0
  assert.deepEqual(normalizePhone('+91 98765-43210'), OK); // +91 with spaces/dashes
  assert.deepEqual(normalizePhone('+91 (98765) 43.210'), OK);
  assert.deepEqual(normalizePhone('919876543210'), OK); // 91 without +
  assert.deepEqual(normalizePhone('0091 98765 43210'), OK); // 0091 prefix
  assert.deepEqual(normalizePhone('+919876543210'), OK); // already correct
  assert.deepEqual(normalizePhone('​98765 43210﻿'), OK); // invisible characters
  assert.deepEqual(normalizePhone('Mob: 98765 43210'), OK); // letters
});

test('normalizePhone: invalid numbers are never guessed', () => {
  for (const bad of ['98765', '98765432', '9876543210123', '+91 98765 432101', '5876543210', '0123456789', '+91 12345 67890', '', '   ', null, undefined, 'abc']) {
    assert.equal(normalizePhone(bad as string), null, String(bad));
  }
  assert.equal(normalizePhone('447911123456'), null, 'a foreign number without + is not guessed');
});

test('normalizePhone: a foreign number written with + is kept', () => {
  assert.deepEqual(normalizePhone('+44 7911 123456'), { e164: '+447911123456', waDigits: '447911123456', display: '+447911123456' });
  assert.deepEqual(normalizePhone('00 971 50 123 4567'), { e164: '+971501234567', waDigits: '971501234567', display: '+971501234567' });
  assert.equal(normalizePhone('+1 234'), null);
});

test('links: correct chat, message encoded, never a link without a valid number', () => {
  const msg = 'வணக்கம் ₹1,100 🙏\nநன்றி';
  const link = buildWhatsAppLink('98765 43210', msg)!;
  assert.ok(link.startsWith('https://wa.me/919876543210?text='));
  assert.equal(decodeURIComponent(link.split('?text=')[1]), msg);
  assert.equal(buildWhatsAppLink('12345', msg), null);
  assert.equal(buildWhatsAppLink('', msg), null, 'no "Send to…" picker link');
  assert.equal(buildSmsLink('09876543210', 'Hi'), 'sms:+919876543210?body=Hi');
  assert.equal(buildSmsUrl('9876543210', 'Hi'), 'sms:+919876543210?body=Hi');
  assert.equal(buildCallLink('0091 98765 43210'), 'tel:+919876543210');
  assert.equal(buildCallLink('98765'), null);
});

test('older helpers go through the same rules', () => {
  assert.equal(whatsappNumber('98765 43210'), '919876543210');
  assert.equal(whatsappNumber('98765'), '', 'invalid → empty, so "can send?" checks fail safely');
  assert.equal(normalizeIndianNumber('+447911123456'), null);
  assert.equal(normalizeIndianNumber('09876543210'), '919876543210');
  assert.equal(toE164('9876543210'), '+919876543210');
  assert.equal(displayPhone('919876543210'), '+91 98765 43210');
  assert.equal(displayPhone('123'), '123');
  assert.deepEqual([phoneProblem(''), phoneProblem('123'), phoneProblem('9876543210')], ['missing', 'invalid', null]);
});

test('the migration repeats the same rules in SQL and is safe to re-run', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261122120000_00029_normalize_phone_numbers.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes("CREATE OR REPLACE FUNCTION normalize_phone(p text)"));
  assert.ok(sql.includes("length(d) BETWEEN 8 AND 15"));
  assert.ok(sql.includes("IS DISTINCT FROM normalize_phone"), 'only rows that change are updated');
  for (const col of ["('sponsors', 'phone')", "('sponsors', 'whatsapp')", "('monthly_sponsors', 'phone')", "('special_occasions', 'contact_phone')", "('organization_settings', 'admin_whatsapp_number')", "('app_users', 'phone')"]) {
    assert.ok(sql.includes(col), col);
  }
});

test('Numbers to fix lists invalid numbers with where they are used', () => {
  const issues = findPhoneIssues({
    sponsors: [{ id: 's1', full_name: 'Ravi', phone: '12345', whatsapp: '9876543210' }, { id: 's2', full_name: 'Meena', phone: null, whatsapp: '' }],
    monthly_sponsors: [{ id: 'm1', name: 'Sudhan', phone: '5555555555' }, { id: 'm2', name: 'Gone', phone: '1', deleted_at: '2026-11-01' }],
    organization_settings: [{ id: 'o1', phone: '+91 96295 22777', admin_whatsapp_number: '919629522777', ack_whatsapp: 'x' }],
  });
  assert.deepEqual(issues.map((i) => [i.name, i.where, i.value]), [
    ['Ravi', 'Sponsor · Alternate mobile', '12345'],
    ['Sudhan', 'Monthly sponsor · Phone', '5555555555'],
    ['Acknowledgment recipient', 'Settings · Acknowledgment WhatsApp', 'x'],
  ]);
});

test('CSV is Excel-safe: BOM, every field quoted, quotes doubled, CRLF', () => {
  const csv = buildCsv([['Name', 'Amount'], ['Ravi "R" Kumar', 1100], ['வள்ளலார், அறக்கட்டளை', null]]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv, '﻿"Name","Amount"\r\n"Ravi ""R"" Kumar","1100"\r\n"வள்ளலார், அறக்கட்டளை",""\r\n');
  assert.equal(ddmmyyyy('2026-11-05'), '05-11-2026');
  assert.equal(ddmmyyyy('2026-11-04T20:00:00Z'), '05-11-2026', 'timestamps in IST');
  assert.equal(plainAmount('₹1,00,000'), 100000);
  assert.equal(plainAmount('1100.00'), 1100);
});

const d = (over: Partial<ReportDonation>): ReportDonation => ({
  id: Math.random().toString(36), donation_id: null, sponsor_id: 's', sponsorship_request_id: null, occasion_id: null, occasion_name: null,
  donation_date: '2026-11-10', type: 'Money', amount: 0, food_quantity: null, people_helped: 0, location: null, food_type: null,
  food_description: null, payment_method: null, transaction_id: null, receipt_number: null, notes: null, status: 'completed',
  created_by: null, created_at: '2026-12-01T10:00:00Z', updated_at: '', ...over,
} as ReportDonation);

test('monthly report: every donation of the month, by donation date, with totals and a sponsor summary', () => {
  const donations = [
    d({ donation_date: '2026-11-21', amount: 5000, sponsors: { full_name: 'Ravi', whatsapp: '98765 43210' } }),
    d({ donation_date: '2026-11-03', amount: 1100, type: 'Food', sponsors: { full_name: 'Meena', phone: '09123456789' }, occasion_name: 'Birthday' }),
    d({ donation_date: '2026-11-21', amount: '100000' as unknown as number, sponsors: { full_name: 'Anand' } }),
    d({ donation_date: '2026-11-25', amount: 750, sponsor_type: 'monthly', monthly_sponsor_id: 'm1', monthly_sponsors: { name: 'Ravi', phone: '9876543210' } }),
    d({ donation_date: '2026-10-31', amount: 999, sponsors: { full_name: 'October' } }),
    d({ donation_date: '2026-12-01', amount: 999, sponsors: { full_name: 'December' } }),
  ];
  const logs = [{ message_type: 'donation_thanks', related_donation_id: donations[0].id, status: 'sent', sent_at: '2026-11-21T06:00:00Z', sent_by_name: 'Priya' }] as MessageLog[];
  const r = buildMonthlyReport(donations, logs, '2026-11-01', 'Priya', new Date('2026-11-22T04:30:00Z'));
  assert.deepEqual(r.rows.map((x) => [x.sno, x.date, x.name, x.amount]), [
    [1, '2026-11-03', 'Meena', 1100], [2, '2026-11-21', 'Anand', 100000], [3, '2026-11-21', 'Ravi', 5000], [4, '2026-11-25', 'Ravi', 750],
  ]);
  assert.equal(r.total, 106850);
  assert.equal(r.count, 4);
  assert.deepEqual([r.money, r.food], [105750, 1100]);
  assert.equal(r.rows[0].phone, '+91 91234 56789');
  assert.equal(r.rows[3].monthly, 'Yes');
  assert.deepEqual([r.rows[2].thanks, r.rows[2].thanksOn, r.rows[2].sentBy], ['Sent', '21-11-2026', 'Priya']);
  assert.equal(r.rows[0].note, 'Birthday');
  assert.equal(r.subtitle, 'Monthly Donation Report – November 2026');
  assert.equal(r.generated, 'Generated on 22-11-2026 10:00 IST by Priya');
  assert.deepEqual(r.summary.map((s) => [s.name, s.count, s.amount]), [['Anand', 1, 100000], ['Ravi', 2, 5750], ['Meena', 1, 1100]]);
  assert.equal(reportFileName('2026-11-01', 'xlsx'), 'VP-Trust-Donations-2026-11.xlsx');

  const csv = buildCsv(monthlyReportCsvRows(r));
  assert.ok(csv.includes('"1","03-11-2026","Meena","+91 91234 56789","Food","No","Birthday","1100"'));
  assert.ok(csv.includes('"","","TOTAL","","","","","106850"'));
  assert.ok(!csv.includes('₹1,') && !csv.includes('[object Object]'));
});

test('a month with no donations still makes a file', () => {
  const r = buildMonthlyReport([], [], '2027-02-01', 'Priya');
  assert.equal(r.count, 0);
  assert.ok(buildCsv(monthlyReportCsvRows(r)).includes('"No donations recorded for this month"'));
});

test('xlsx: real dates and numbers, Indian ₹ format, frozen bold header, totals, Sponsor Summary sheet', async () => {
  const ExcelJS = (await import('exceljs')).default;
  const r = buildMonthlyReport([
    d({ donation_date: '2026-11-03', amount: 1100, type: 'Food', sponsors: { full_name: 'மீனா', phone: '9123456789' } }),
    d({ donation_date: '2026-11-21', amount: 5000, sponsors: { full_name: 'Ravi', whatsapp: '9876543210' } }),
  ], [], '2026-11-01', 'Priya');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await monthlyReportXlsx(r));
  const ws = wb.getWorksheet('Donations')!;
  assert.equal(ws.getCell('A1').value, 'VP TRUST – வள்ளலார் பசியாற்றும் அறக்கட்டளை');
  assert.equal(ws.views[0].state, 'frozen');
  assert.equal(ws.getRow(5).font?.bold, true);
  const first = ws.getRow(6);
  assert.ok(first.getCell(2).value instanceof Date);
  assert.equal((first.getCell(2).value as Date).toISOString().slice(0, 10), '2026-11-03');
  assert.equal(first.getCell(2).numFmt, 'dd-mm-yyyy');
  assert.equal(first.getCell(3).value, 'மீனா');
  assert.equal(first.getCell(4).value, '+91 91234 56789');
  assert.equal(first.getCell(8).value, 1100);
  assert.match(first.getCell(8).numFmt, /₹/);
  assert.ok((ws.getColumn(2).width || 0) >= 11, 'date column wide enough (no #####)');
  let total: number | null = null;
  ws.eachRow((row) => { if (row.getCell(3).value === 'TOTAL') total = row.getCell(8).value as number; });
  assert.equal(total, 6100);
  const summary = wb.getWorksheet('Sponsor Summary')!;
  assert.deepEqual([summary.getCell('A2').value, summary.getCell('D2').value], ['Ravi', 5000]);

  const empty = new ExcelJS.Workbook();
  await empty.xlsx.load(await monthlyReportXlsx(buildMonthlyReport([], [], '2027-02-01', '')));
  assert.equal(empty.getWorksheet('Donations')!.getCell('A6').value, 'No donations recorded for this month');
});
