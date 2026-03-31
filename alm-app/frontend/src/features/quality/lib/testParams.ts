import type { TestPlanEntry, TestStep } from "../types";
import { isTestPlanCall } from "../types";

/** Parameter definition on a test case. */
export interface ParamDef {
  name: string;
  label?: string;
  default?: string;
}

/** One dataset row: optional UI label + values keyed by param name. */
export interface ParamRow {
  label?: string;
  values: Record<string, string>;
}

export interface TestParamsDocument {
  defs: ParamDef[];
  rows?: ParamRow[];
}

const PARAM_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const PLACEHOLDER_GLOBAL = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Normalize defs and rows; each row must be `{ label?, values: Record<...> }`. */
export function normalizeTestParams(doc: TestParamsDocument): TestParamsDocument {
  const seen = new Set<string>();
  const defs = doc.defs
    .map((d) => ({
      name: String(d.name ?? "").trim(),
      label: typeof d.label === "string" ? d.label.trim() || undefined : undefined,
      default: typeof d.default === "string" ? d.default : undefined,
    }))
    .filter((d) => d.name && PARAM_NAME_PATTERN.test(d.name))
    .filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });

  const rowsRaw = Array.isArray(doc.rows) ? doc.rows : [];
  const rows: ParamRow[] = [];
  for (const r of rowsRaw) {
    if (!isPlainObject(r) || !("values" in r) || !isPlainObject((r as ParamRow).values)) continue;
    const pr = r as ParamRow;
    rows.push({
      label: typeof pr.label === "string" ? pr.label.trim() || undefined : undefined,
      values: Object.fromEntries(
        Object.entries(pr.values).map(([k, v]) => [k, v === undefined || v === null ? "" : String(v)]),
      ),
    });
  }

  return { defs, rows: rows.length > 0 ? rows : undefined };
}

export function parseTestParams(raw: unknown): TestParamsDocument | null {
  if (raw == null) return null;
  let v: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(v)) return null;
  const defsRaw = v.defs;
  if (!Array.isArray(defsRaw)) return null;
  const defs: ParamDef[] = defsRaw
    .filter(isPlainObject)
    .map((d) => ({
      name: typeof d.name === "string" ? d.name : "",
      label: typeof d.label === "string" ? d.label : undefined,
      default: typeof d.default === "string" ? d.default : undefined,
    }));
  const rows = Array.isArray(v.rows) ? (v.rows as unknown[]) : undefined;
  const doc = normalizeTestParams({ defs, rows: rows as ParamRow[] | undefined });
  if (doc.defs.length === 0 && (!doc.rows || doc.rows.length === 0)) return null;
  if (doc.defs.length === 0 && doc.rows && doc.rows.length > 0) return null;
  return doc;
}

export function serializeTestParams(doc: TestParamsDocument): Record<string, unknown> {
  const n = normalizeTestParams(doc);
  const out: Record<string, unknown> = { defs: n.defs };
  if (n.rows && n.rows.length > 0) out.rows = n.rows;
  return out;
}

/** Default values from defs only (for callee merge). */
export function defaultsFromDefs(defs: ParamDef[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const d of defs) {
    if (d.default !== undefined && d.default !== "") m[d.name] = d.default;
  }
  return m;
}

/**
 * Build substitution map: defaults from defs, then row values overlay, then explicit row cells.
 * `rowIndex` null => defaults only (and empty string for defs without default).
 */
export function buildParamValuesMap(
  doc: TestParamsDocument | null,
  rowIndex: number | null,
): Record<string, string> {
  if (!doc?.defs.length) return {};
  const map: Record<string, string> = {};
  for (const d of doc.defs) {
    map[d.name] = d.default ?? "";
  }
  if (rowIndex !== null && doc.rows && rowIndex >= 0 && rowIndex < doc.rows.length) {
    const row = doc.rows[rowIndex];
    if (row?.values) {
      for (const [k, val] of Object.entries(row.values)) {
        if (map[k] !== undefined || doc.defs.some((x) => x.name === k)) {
          map[k] = val;
        }
      }
    }
  }
  return map;
}

export function applyTestParamsToText(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_GLOBAL, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name]! : `\${${name}}`,
  );
}

export function applyTestParamsToStep(step: TestStep, values: Record<string, string>): TestStep {
  return {
    ...step,
    name: applyTestParamsToText(step.name, values),
    description: applyTestParamsToText(step.description, values),
    expectedResult: applyTestParamsToText(step.expectedResult, values),
  };
}

export function applyTestParamsToSteps(steps: TestStep[], values: Record<string, string>): TestStep[] {
  return steps.map((s) => applyTestParamsToStep(s, values));
}

export function listUnresolvedInText(text: string, values: Record<string, string>): string[] {
  const missing = new Set<string>();
  let m: RegExpExecArray | null;
  const re = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  while ((m = re.exec(text)) !== null) {
    const name = m[1]!;
    if (!Object.prototype.hasOwnProperty.call(values, name)) missing.add(name);
  }
  return [...missing];
}

export function listUnresolvedInSteps(steps: TestStep[], values: Record<string, string>): string[] {
  const acc = new Set<string>();
  for (const s of steps) {
    for (const x of listUnresolvedInText(s.name, values)) acc.add(x);
    for (const x of listUnresolvedInText(s.description, values)) acc.add(x);
    for (const x of listUnresolvedInText(s.expectedResult, values)) acc.add(x);
  }
  return [...acc];
}

export function extractReferencedParamNamesFromPlan(entries: TestPlanEntry[]): Set<string> {
  const names = new Set<string>();
  for (const e of entries) {
    if (isTestPlanCall(e)) continue;
    const scan = (t: string) => {
      let m: RegExpExecArray | null;
      const re = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
      while ((m = re.exec(t)) !== null) names.add(m[1]!);
    };
    scan(e.name);
    scan(e.description);
    scan(e.expectedResult);
  }
  return names;
}

export function rowLabelForIndex(doc: TestParamsDocument, index: number): string {
  const row = doc.rows?.[index];
  if (row?.label?.trim()) return row.label.trim();
  const firstKey = doc.defs[0]?.name;
  const preview = firstKey && row?.values?.[firstKey] != null ? String(row.values[firstKey]) : "";
  if (preview) return `${index + 1}: ${preview.slice(0, 40)}${preview.length > 40 ? "…" : ""}`;
  return `Row ${index + 1}`;
}
