/**
 * Tries to read a 1-based line number from JSON.parse SyntaxError messages (V8/Chromium style).
 */
export function jsonParseErrorLine(error: unknown): number | undefined {
  if (!(error instanceof SyntaxError)) return undefined;
  const lineMatch = error.message.match(/\(\s*line\s+(\d+)/i);
  if (lineMatch) {
    const n = parseInt(lineMatch[1] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}
