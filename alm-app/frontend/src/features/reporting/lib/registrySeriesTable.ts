/**
 * If registry run `data.series` is a list of plain objects with consistent keys,
 * returns columns + rows for CSV export. Otherwise null.
 */
export function registrySeriesTable(
  data: Record<string, unknown>,
): { columns: string[]; rows: Record<string, unknown>[] } | null {
  const series = data.series;
  if (!Array.isArray(series) || series.length === 0) return null;
  const first = series[0];
  if (first == null || typeof first !== "object" || Array.isArray(first)) return null;
  const columns = Object.keys(first as Record<string, unknown>);
  if (columns.length === 0) return null;
  const rows: Record<string, unknown>[] = [];
  for (const item of series) {
    if (item != null && typeof item === "object" && !Array.isArray(item)) {
      rows.push(item as Record<string, unknown>);
    }
  }
  return rows.length ? { columns, rows } : null;
}
