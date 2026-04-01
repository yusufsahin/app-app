import type { FormFieldSchema, FormSchemaDto, VisibleWhenCondition } from "../../types/formSchema";
import type { ListSchemaDto } from "../../types/listSchema";
import type { TabularColumnModel, TabularEditorKind } from "./types";
import { getFieldLookup, type SchemaLookupSources, resolveFieldOptions, resolveLookupLabel } from "./lookupResolvers";

interface SchemaToGridColumnsOptions<T> {
  listSchema?: ListSchemaDto | null;
  formSchema?: FormSchemaDto | null;
  getCellValue: (row: T, columnKey: string) => string | number | undefined | null;
  getContextValue?: (row: T, key: string) => unknown;
  pinnedColumnKeys?: string[];
  lookupSources?: SchemaLookupSources;
  overrides?: Partial<Record<string, Partial<TabularColumnModel<T>>>>;
}

function columnLabel(label?: string, labelKey?: string, fallback?: string): string {
  return label?.trim() || labelKey?.trim() || fallback || "";
}

function evaluateVisibleWhen(
  condition: VisibleWhenCondition | undefined,
  getValue: (key: string) => unknown,
): boolean {
  if (!condition) return true;
  const fieldValue = getValue(condition.field);
  if (condition.eq !== undefined) return fieldValue === condition.eq;
  if (condition.in !== undefined) return condition.in.includes(fieldValue as string | number);
  return true;
}

function inferEditorKind(field?: FormFieldSchema): TabularEditorKind {
  if (!field) return "readonly";
  const lookup = getFieldLookup(field);
  if (field.type === "number") return "number";
  if (field.type === "choice") return "singleSelect";
  if (lookup?.multi) return "multiSelectText";
  if (lookup) return "singleSelect";
  if (field.type === "date" || field.type === "datetime") return "date";
  if (field.type === "string") return "text";
  return "readonly";
}

function isFieldSupported(field?: FormFieldSchema): boolean {
  if (!field) return false;
  if (["string", "number", "choice", "date", "datetime", "tag_list"].includes(field.type)) return true;
  return field.type === "entity_ref" && Boolean(getFieldLookup(field));
}

function normalizeDisplayValue(
  field: FormFieldSchema | undefined,
  fallbackValue: string | number | undefined | null,
  rawValue: unknown,
  options: { value: string; label: string }[],
): string {
  if ((field?.type === "choice" || field?.type === "entity_ref") && options.length) {
    const selected = resolveLookupLabel(rawValue, options);
    if (selected) return selected;
  }
  if (field?.type === "tag_list" && options.length && Array.isArray(rawValue)) {
    const labels = rawValue
      .map((item) => resolveLookupLabel(item, options) ?? String(item))
      .filter(Boolean);
    return labels.join(", ");
  }
  if (fallbackValue === undefined || fallbackValue === null || fallbackValue === "") return "";
  return String(fallbackValue);
}

function defaultCommitValue(field: FormFieldSchema | undefined, value: unknown): unknown {
  if (field?.type === "number") {
    if (value === "" || value === null || value === undefined) return null;
    return typeof value === "number" ? value : Number(value);
  }
  if (field?.type === "date" || field?.type === "datetime") {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
  }
  if (field?.type === "tag_list") {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (!value) return [];
  }
  return value;
}

function isEmptyValue(value: unknown): boolean {
  if (value === "" || value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isRequiredForRow(
  field: FormFieldSchema | undefined,
  getValue: (key: string) => unknown,
): boolean {
  if (!field) return false;
  if (field.required) return true;
  return evaluateVisibleWhen(field.required_when, getValue);
}

export function schemaToGridColumns<T>({
  listSchema,
  formSchema,
  getCellValue,
  getContextValue,
  pinnedColumnKeys = [],
  lookupSources,
  overrides,
}: SchemaToGridColumnsOptions<T>): TabularColumnModel<T>[] {
  const sortedColumns = [...(listSchema?.columns ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const fieldsByKey = new Map((formSchema?.fields ?? []).map((field) => [field.key, field]));
  const pinnedKeysSet = new Set(pinnedColumnKeys);

  return sortedColumns.map((column) => {
    const fieldKey = column.write_key ?? column.key;
    const field = fieldsByKey.get(fieldKey);
    const supported = isFieldSupported(field);
    const editorKind = inferEditorKind(field);
    const resolvedOptions = resolveFieldOptions({ field, lookupSources });

    const base: TabularColumnModel<T> = {
      key: column.key,
      fieldKey,
      label: columnLabel(column.label, column.label_key, column.key),
      width: column.width,
      pinned: pinnedKeysSet.has(column.key),
      editorKind,
      writeTarget: field?.write_target ?? column.write_target ?? null,
      lookup: field?.lookup ?? column.lookup ?? null,
      isSupported: supported,
      isEditable: (row) => {
        if (!field || !supported) return false;
        if (field.editable === false && column.editable !== true) return false;
        if (field.surfaces?.length && !field.surfaces.includes("tabular")) return false;
        const readContext = (key: string) => {
          if (getContextValue) return getContextValue(row, key);
          if (key in (row as Record<string, unknown>)) return (row as Record<string, unknown>)[key];
          return undefined;
        };
        return evaluateVisibleWhen(field.visible_when, readContext);
      },
      getRawValue: (row) => {
        if (column.key in (row as Record<string, unknown>)) {
          const rootValue = (row as Record<string, unknown>)[column.key];
          if (rootValue !== undefined) return rootValue;
        }
        const customFields = (row as { custom_fields?: Record<string, unknown> }).custom_fields;
        if (customFields && column.key in customFields) return customFields[column.key];
        return getCellValue(row, column.key);
      },
      getDisplayValue: (row, value) => normalizeDisplayValue(field, getCellValue(row, column.key), value, resolvedOptions),
      toCommitValue: (value) => defaultCommitValue(field, value),
      validate: (value, row) => {
        if (!field) return null;
        const readContext = (key: string) => {
          if (getContextValue) return getContextValue(row, key);
          if (key in (row as Record<string, unknown>)) return (row as Record<string, unknown>)[key];
          return undefined;
        };
        if (isRequiredForRow(field, readContext) && isEmptyValue(value)) {
          return `${columnLabel(field.label_key, undefined, column.key)} is required.`;
        }
        if (field.type === "number" && value != null && value !== "" && Number.isNaN(Number(value))) {
          return `${columnLabel(field.label_key, undefined, column.key)} must be a number.`;
        }
        return null;
      },
      getOptions: resolvedOptions.length > 0 ? () => resolvedOptions : undefined,
    };

    return {
      ...base,
      ...(overrides?.[column.key] ?? {}),
    };
  });
}
