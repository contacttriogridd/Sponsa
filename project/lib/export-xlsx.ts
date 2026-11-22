/** The Monthly Donation Report workbook (ExcelJS, loaded only when needed). No DOM, so it can be tested. */
import { REPORT_COLUMNS, type MonthlyReport } from '@/lib/export';

/** ₹ with Indian digit grouping (₹1,100 · ₹1,00,000), whatever the computer's locale. */
export const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"##,##0';
const DATE_FORMAT = 'dd-mm-yyyy';
const asDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromDdmmyyyy = (s: string) => { const [d, m, y] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

/** Monthly Donation Report as .xlsx: real dates and numbers, bold frozen header, fitted columns, totals, and a Sponsor Summary sheet. */
export async function monthlyReportXlsx(r: MonthlyReport): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VP TRUST';
  wb.created = new Date();

  const HEADER_ROW = 5;
  const ws = wb.addWorksheet('Donations', { views: [{ state: 'frozen', ySplit: HEADER_ROW }] });
  ws.addRow([r.title]).font = { bold: true, size: 14 };
  ws.addRow([r.subtitle]).font = { bold: true, size: 12 };
  ws.addRow([r.generated]).font = { italic: true, color: { argb: 'FF666666' } };
  ws.addRow([]);
  const header = ws.addRow([...REPORT_COLUMNS]);
  header.font = { bold: true };
  header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } }; c.border = { bottom: { style: 'thin' } }; });

  // Text columns stay text (so Excel never turns +91… into 9.19E+11).
  ws.getColumn(4).numFmt = '@';
  if (!r.rows.length) {
    ws.addRow(['No donations recorded for this month']).font = { italic: true };
  } else {
    for (const x of r.rows) {
      const row = ws.addRow([x.sno, asDate(x.date), x.name, x.phone, x.type, x.monthly, x.note, x.amount, x.thanks, x.thanksOn ? fromDdmmyyyy(x.thanksOn) : null, x.sentBy]);
      row.getCell(2).numFmt = DATE_FORMAT;
      row.getCell(8).numFmt = INR_FORMAT;
      row.getCell(10).numFmt = DATE_FORMAT;
    }
    ws.addRow([]);
    const totals: [string, number, boolean][] = [['TOTAL', r.total, true], ['Number of donations', r.count, false], ['Subtotal – Money', r.money, true], ['Subtotal – Food', r.food, true]];
    for (const [label, value, money] of totals) {
      const row = ws.addRow(['', '', label, '', '', '', '', value]);
      row.font = { bold: true };
      if (money) row.getCell(8).numFmt = INR_FORMAT;
    }
  }

  // Auto-fit: widest value per column (dates need ~11), so nothing shows as #####.
  const widths = REPORT_COLUMNS.map((h) => h.length);
  ws.eachRow((row, n) => {
    if (n < HEADER_ROW) return;
    row.eachCell((c, col) => {
      const v = c.value instanceof Date ? 'dd-mm-yyyy' : typeof c.value === 'number' && col === 8 ? `₹${c.value.toLocaleString('en-IN')}` : String(c.value ?? '');
      widths[col - 1] = Math.max(widths[col - 1] || 0, v.length);
    });
  });
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = Math.min(Math.max(w + 2, 8), 60); });

  const sum = wb.addWorksheet('Sponsor Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  const sh = sum.addRow(['Sponsor Name', 'Phone', 'Number of Donations', 'Total Amount (₹)']);
  sh.font = { bold: true };
  sum.getColumn(2).numFmt = '@';
  for (const s of r.summary) sum.addRow([s.name, s.phone, s.count, s.amount]).getCell(4).numFmt = INR_FORMAT;
  if (r.summary.length) {
    const t = sum.addRow(['TOTAL', '', r.count, r.total]);
    t.font = { bold: true };
    t.getCell(4).numFmt = INR_FORMAT;
  } else {
    sum.addRow(['No donations recorded for this month']);
  }
  [Math.max(14, ...r.summary.map((s) => s.name.length)) + 2, 18, 20, 18].forEach((w, i) => { sum.getColumn(i + 1).width = Math.min(w, 60); });

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

