/** Build a short search query from a defect title (e.g. “find similar”). */
export function buildSimilarDefectSearchQuery(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+|[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]+$/g, ""))
    .filter((w) => w.length > 2)
    .slice(0, 5);
  if (words.length > 0) return words.join(" ");
  return title.trim().slice(0, 120);
}
