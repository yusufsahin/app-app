function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Builds CSV text with UTF-8 BOM for Excel and similar tools. */
export function buildReportCsvContent(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const lines = [header];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(row[c])).join(","));
  }
  return `\ufeff${lines.join("\n")}`;
}

/**
 * Triggers a browser download of execute preview rows as CSV (UTF-8 with BOM).
 */
export function downloadReportCsv(
  filenameBase: string,
  columns: string[],
  rows: Record<string, unknown>[],
): void {
  const safe = filenameBase.replace(/[^\w-]+/g, "_").slice(0, 80) || "report";
  const content = buildReportCsvContent(columns, rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Browser download of pretty-printed JSON (UTF-8). */
export function downloadJsonFile(filenameBase: string, value: unknown): void {
  const safe = filenameBase.replace(/[^\w-]+/g, "_").slice(0, 80) || "export";
  const text = JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
