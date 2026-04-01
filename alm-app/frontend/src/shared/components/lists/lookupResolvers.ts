import type { FormFieldSchema, SchemaLookup, SchemaLookupKind } from "../../types/formSchema";
import type { TabularOption } from "./types";

export type SchemaLookupSources = Partial<Record<SchemaLookupKind, TabularOption[]>>;

export interface ResolveLookupOptionsArgs {
  field?: FormFieldSchema;
  lookupSources?: SchemaLookupSources;
}

function dedupeOptions(options: TabularOption[]): TabularOption[] {
  const seen = new Set<string>();
  const deduped: TabularOption[] = [];
  for (const option of options) {
    const value = String(option.value);
    if (seen.has(value)) continue;
    seen.add(value);
    deduped.push({ ...option, value });
  }
  return deduped;
}

export function mapLookupItems<T>(
  items: readonly T[] | null | undefined,
  getValue: (item: T) => string,
  getLabel: (item: T) => string,
): TabularOption[] {
  return (items ?? []).map((item) => ({
    value: String(getValue(item)),
    label: String(getLabel(item)),
  }));
}

export function getFieldLookup(field?: FormFieldSchema): SchemaLookup | null {
  if (!field) return null;
  if (field.lookup) return field.lookup;
  if (field.type === "tag_list") return { kind: "tag", multi: true };
  if (field.type === "entity_ref" && field.entity_ref) {
    return { kind: field.entity_ref, multi: false };
  }
  return null;
}

export function resolveFieldOptions({ field, lookupSources }: ResolveLookupOptionsArgs): TabularOption[] {
  const staticOptions = (field?.options ?? []).map((option) => ({
    value: option.id,
    label: option.label,
  }));
  const lookup = getFieldLookup(field);
  const dynamicOptions = lookup ? lookupSources?.[lookup.kind] ?? [] : [];
  return dedupeOptions([...staticOptions, ...dynamicOptions]);
}

export function resolveLookupLabel(value: unknown, options: TabularOption[]): string | null {
  if (value == null || value === "") return null;
  const match = options.find((option) => option.value === String(value));
  return match?.label ?? null;
}

