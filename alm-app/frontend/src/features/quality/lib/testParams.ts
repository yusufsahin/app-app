import type { TestPlanEntry, TestStep } from "../types";
import { isTestPlanCall } from "../types";

export type ParamType = "string" | "number" | "boolean" | "secret" | "enum";

/** Parameter definition on a test case. */
export interface ParamDef {
  name: string;
  label?: string;
  default?: string;
  type?: ParamType;
  required?: boolean;
  allowedValues?: string[];
}

/** One named configuration row with a stable identity. */
export interface ParamRow {
  id: string;
  name?: string;
  label?: string;
  values: Record<string, string>;
  isDefault?: boolean;
  status?: "active" | "draft" | "archived";
  tags?: string[];
}

export interface TestParamsDocument {
  v?: 2;
  defs: ParamDef[];
  rows?: ParamRow[];
}

const PARAM_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const PLACEHOLDER_GLOBAL = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const VALID_PARAM_TYPES = new Set<ParamType>(["string", "number", "boolean", "secret", "enum"]);
const VALID_ROW_STATUS = new Set<NonNullable<ParamRow["status"]>>(["active", "draft", "archived"]);

export type TestParamsValidation = {
  paramErrors: string[];
  rowErrors: string[];
  hasErrors: boolean;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function makeRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cfg-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeParamType(value: unknown): ParamType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "string";
  return VALID_PARAM_TYPES.has(normalized as ParamType) ? (normalized as ParamType) : "string";
}

function normalizeAllowedValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((item) => (item == null ? "" : String(item)))
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRow(raw: unknown, defNames: Set<string>): ParamRow | null {
  if (!isPlainObject(raw)) return null;
  const sourceValues =
    "values" in raw && isPlainObject(raw.values)
      ? raw.values
      : Object.fromEntries(
          Object.entries(raw).filter(([key]) => !["id", "name", "label", "isDefault", "status", "tags"].includes(key)),
        );
  const values = Object.fromEntries(
    Object.entries(sourceValues)
      .filter(([key]) => defNames.has(key))
      .map(([key, value]) => [key, value == null ? "" : String(value)]),
  );
  const statusRaw = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : makeRowId(),
    name: typeof raw.name === "string" ? raw.name.trim() || undefined : undefined,
    label: typeof raw.label === "string" ? raw.label.trim() || undefined : undefined,
    values,
    isDefault: raw.isDefault === true ? true : undefined,
    status: VALID_ROW_STATUS.has(statusRaw as NonNullable<ParamRow["status"]>)
      ? (statusRaw as NonNullable<ParamRow["status"]>)
      : undefined,
    tags: Array.isArray(raw.tags)
      ? raw.tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean)
      : undefined,
  };
}

/** Normalize defs and rows; each row is a named configuration with a stable id. */
export function normalizeTestParams(doc: TestParamsDocument): TestParamsDocument {
  const seen = new Set<string>();
  const defs = doc.defs
    .map((d) => ({
      name: String(d.name ?? "").trim(),
      label: typeof d.label === "string" ? d.label.trim() || undefined : undefined,
      default: typeof d.default === "string" ? d.default : undefined,
      type: normalizeParamType(d.type),
      required: d.required === true ? true : undefined,
      allowedValues: normalizeAllowedValues(d.allowedValues),
    }))
    .filter((d) => d.name && PARAM_NAME_PATTERN.test(d.name))
    .filter((d) => {
      if (seen.has(d.name)) return false;
      seen.add(d.name);
      return true;
    });

  const rowsRaw = Array.isArray(doc.rows) ? doc.rows : [];
  const rows: ParamRow[] = [];
  const defNames = new Set(defs.map((d) => d.name));
  for (const r of rowsRaw) {
    const normalized = normalizeRow(r, defNames);
    if (normalized) rows.push(normalized);
  }

  return { v: 2, defs, rows: rows.length > 0 ? rows : undefined };
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
      type: normalizeParamType(d.type),
      required: d.required === true ? true : undefined,
      allowedValues: normalizeAllowedValues(d.allowedValues),
    }));
  const rows = Array.isArray(v.rows) ? (v.rows as unknown[]) : undefined;
  const doc = normalizeTestParams({ defs, rows: rows as ParamRow[] | undefined });
  if (doc.defs.length === 0 && (!doc.rows || doc.rows.length === 0)) return null;
  if (doc.defs.length === 0 && doc.rows && doc.rows.length > 0) return null;
  return doc;
}

export function serializeTestParams(doc: TestParamsDocument): Record<string, unknown> {
  const n = normalizeTestParams(doc);
  const out: Record<string, unknown> = { v: 2, defs: n.defs };
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
  rowId: string | null,
): Record<string, string> {
  if (!doc?.defs.length) return {};
  const map: Record<string, string> = {};
  for (const d of doc.defs) {
    map[d.name] = d.default ?? "";
  }
  if (rowId !== null && doc.rows) {
    const row = doc.rows.find((item) => item.id === rowId) ?? null;
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
  if (row?.name?.trim()) return row.name.trim();
  if (row?.label?.trim()) return row.label.trim();
  const firstKey = doc.defs[0]?.name;
  const preview = firstKey && row?.values?.[firstKey] != null ? String(row.values[firstKey]) : "";
  if (preview) return `${index + 1}: ${preview.slice(0, 40)}${preview.length > 40 ? "…" : ""}`;
  return `Row ${index + 1}`;
}

export function rowLabelForId(doc: TestParamsDocument, rowId: string | null | undefined): string | null {
  if (!rowId) return null;
  const index = doc.rows?.findIndex((row) => row.id === rowId) ?? -1;
  if (index < 0) return null;
  return rowLabelForIndex(doc, index);
}

export function validateTestParams(doc: TestParamsDocument): TestParamsValidation {
  const normalized = normalizeTestParams(doc);
  const paramErrors: string[] = [];
  const rowErrors: string[] = [];
  const seenRows = new Set<string>();
  let defaultCount = 0;
  for (const def of normalized.defs) {
    if (!PARAM_NAME_PATTERN.test(def.name)) {
      paramErrors.push(`Invalid parameter name: ${def.name}`);
    }
    if (def.type === "enum" && (!def.allowedValues || def.allowedValues.length === 0)) {
      paramErrors.push(`Enum parameter ${def.name} requires allowed values.`);
    }
    if (def.allowedValues && def.default && !def.allowedValues.includes(def.default)) {
      paramErrors.push(`Default value for ${def.name} must be in allowed values.`);
    }
  }
  for (const row of normalized.rows ?? []) {
    if (!row.id.trim()) rowErrors.push("Each configuration needs a stable ID.");
    if (seenRows.has(row.id)) rowErrors.push("Configuration IDs must be unique.");
    seenRows.add(row.id);
    if (row.isDefault) defaultCount += 1;
    for (const def of normalized.defs) {
      const value = row.values[def.name] ?? "";
      if (def.required && !value && !def.default) {
        rowErrors.push(`Configuration ${row.name ?? row.label ?? row.id} is missing required value ${def.name}.`);
      }
      if (def.allowedValues && value && !def.allowedValues.includes(value)) {
        rowErrors.push(`Configuration ${row.name ?? row.label ?? row.id} has invalid ${def.name} value.`);
      }
    }
    for (const key of Object.keys(row.values)) {
      if (!normalized.defs.some((def) => def.name === key)) {
        rowErrors.push(`Configuration ${row.name ?? row.label ?? row.id} references unknown parameter ${key}.`);
      }
    }
  }
  if (defaultCount > 1) rowErrors.push("Only one configuration can be marked as default.");
  return { paramErrors, rowErrors, hasErrors: paramErrors.length > 0 || rowErrors.length > 0 };
}
