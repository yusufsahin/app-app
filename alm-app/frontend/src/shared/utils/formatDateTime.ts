/** Locale-formatted date/time for display (ISO strings from API). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}
