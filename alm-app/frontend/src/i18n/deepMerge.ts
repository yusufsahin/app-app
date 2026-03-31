/** Deep-merge plain objects (for locale overrides). Arrays and primitives from `patch` replace. */
export function deepMergeLocale<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (typeof patch !== "object" || Array.isArray(patch)) return patch as T;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return patch as T;
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const prev = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev)) {
      out[k] = deepMergeLocale(prev, v) as unknown;
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}
