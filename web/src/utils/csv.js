// Builds a CSV file in the browser and asks the browser to save it.

const escapeCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** rows: array of arrays of cell values → CSV text (CRLF line endings). */
export const toCsv = (rows) => rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');

export function downloadCsv(filename, rows) {
  // Leading BOM so Excel opens UTF-8 (₱, ñ) correctly.
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
