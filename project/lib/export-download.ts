'use client';

import { buildCsv, reportFileName, monthlyReportCsvRows, type Cell, type MonthlyReport } from '@/lib/export';
import { monthlyReportXlsx } from '@/lib/export-xlsx';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel-safe CSV download (UTF-8 BOM, quoted fields, \r\n). */
export function downloadCsv(rows: Cell[][], filename: string) {
  saveBlob(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function downloadMonthlyReportXlsx(r: MonthlyReport) {
  const buffer = await monthlyReportXlsx(r);
  saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), reportFileName(r.month, 'xlsx'));
}

export function downloadMonthlyReportCsv(r: MonthlyReport) {
  downloadCsv(monthlyReportCsvRows(r), reportFileName(r.month, 'csv'));
}
