/**
 * Metadata-driven form — renders form fields from FormSchemaDto.
 */
import dayjs from "dayjs";
import { useMemo } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui";
import { cn } from "../ui/utils";
import type { DescriptionInputMode, FormFieldSchema, FormSchemaDto } from "../../types/formSchema";
import { DescriptionField } from "./DescriptionField";

export interface ParentArtifactOption {
  id: string;
  title: string;
  artifact_type: string;
}

export interface UserOption {
  id: string;
  label: string;
}

export interface MetadataDrivenFormProps {
  schema: FormSchemaDto;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onSubmit: () => void;
  submitLabel?: string;
  disabled?: boolean;
  submitExternally?: boolean;
  parentArtifacts?: ParentArtifactOption[];
  artifactTypeParentMap?: Record<string, string[]>;
  userOptions?: UserOption[];
  cycleOptions?: Array<{ id: string; label: string }>;
  areaOptions?: Array<{ id: string; label: string }>;
  errors?: Record<string, string>;
  disableNativeRequired?: boolean;
}

function evaluateVisibleWhen(
  condition: { field: string; eq?: unknown; in?: unknown[] } | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!condition) return true;
  const fieldVal = values[condition.field];
  if (condition.eq !== undefined) return fieldVal === condition.eq;
  if (condition.in !== undefined)
    return Array.isArray(condition.in) && condition.in.includes(fieldVal as never);
  return true;
}

function getVisibleFields(
  schema: FormSchemaDto,
  values: Record<string, unknown>,
): FormFieldSchema[] {
  return schema.fields.filter((f) =>
    evaluateVisibleWhen(f.visible_when as { field: string; eq?: unknown; in?: unknown[] } | undefined, values),
  );
}

function FieldSelect({
  id,
  label,
  value,
  onChange,
  required,
  error,
  children,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-1.5">
      {label != null && label !== "" && (
        <Label htmlFor={id}>{label}</Label>
      )}
      <Select value={value === "" || value == null ? "__empty__" : value} onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}>
        <SelectTrigger id={id} aria-required={required} aria-invalid={!!error} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function MetadataDrivenForm({
  schema,
  values,
  onChange,
  onSubmit,
  submitLabel = "Submit",
  disabled = false,
  submitExternally = false,
  parentArtifacts = [],
  artifactTypeParentMap,
  userOptions = [],
  cycleOptions = [],
  areaOptions = [],
  errors = {},
  disableNativeRequired = false,
}: MetadataDrivenFormProps) {
  const visibleFields = useMemo(
    () => getVisibleFields(schema, values).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [schema, values],
  );

  const updateField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const isRequired = (field: FormFieldSchema): boolean => {
    if (field.required) return true;
    if (field.required_when) {
      return evaluateVisibleWhen(
        field.required_when as { field: string; eq?: unknown; in?: unknown[] },
        values,
      );
    }
    return false;
  };

  const useNativeRequired = !disableNativeRequired;

  const parentOptions = useMemo(() => {
    if (!artifactTypeParentMap) return parentArtifacts;
    const selectedType = values.artifact_type as string | undefined;
    const allowedParentTypes = artifactTypeParentMap[selectedType ?? ""];
    if (allowedParentTypes === undefined) return [];
    if (!allowedParentTypes.length) return [];
    return parentArtifacts.filter((a) => allowedParentTypes.includes(a.artifact_type));
  }, [parentArtifacts, artifactTypeParentMap, values.artifact_type]);

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        {visibleFields.map((field) => {
          const val = values[field.key];
          const required = isRequired(field);

          if (field.type === "choice") {
            const err = errors[field.key];
            const value = (val ?? field.default_value ?? "") as string;
            return (
              <FieldSelect
                key={field.key}
                id={field.key}
                label={field.label_key}
                value={value}
                onChange={(v) => updateField(field.key, v)}
                required={useNativeRequired && required}
                error={err}
              >
                <SelectItem value="__empty__">Select…</SelectItem>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </FieldSelect>
            );
          }

          if (field.type === "entity_ref" && field.entity_ref === "artifact") {
            const err = errors[field.key];
            const value = (val ?? "") as string;
            return (
              <FieldSelect
                key={field.key}
                id={field.key}
                label={field.label_key}
                value={value}
                onChange={(v) => updateField(field.key, v || null)}
                required={useNativeRequired && required}
                error={err}
              >
                <SelectItem value="__empty__">None (root)</SelectItem>
                {parentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title} ({a.artifact_type})
                  </SelectItem>
                ))}
              </FieldSelect>
            );
          }

          if (field.type === "entity_ref" && field.entity_ref === "user") {
            const err = errors[field.key];
            const value = (val ?? "") as string;
            return (
              <FieldSelect
                key={field.key}
                id={field.key}
                label={field.label_key}
                value={value}
                onChange={(v) => updateField(field.key, v || null)}
                required={useNativeRequired && required}
                error={err}
              >
                <SelectItem value="__empty__">None</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </FieldSelect>
            );
          }

          if ((field.type === "entity_ref" && field.entity_ref === "cycle") || field.key === "cycle_node_id") {
            const err = errors[field.key];
            const value = (val ?? "") as string;
            return (
              <FieldSelect
                key={field.key}
                id={field.key}
                label={field.label_key}
                value={value}
                onChange={(v) => updateField(field.key, v || null)}
                required={useNativeRequired && required}
                error={err}
              >
                <SelectItem value="__empty__">None</SelectItem>
                {cycleOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </FieldSelect>
            );
          }

          if ((field.type === "entity_ref" && field.entity_ref === "area") || field.key === "area_node_id") {
            const err = errors[field.key];
            const value = (val ?? "") as string;
            return (
              <FieldSelect
                key={field.key}
                id={field.key}
                label={field.label_key}
                value={value}
                onChange={(v) => updateField(field.key, v || null)}
                required={useNativeRequired && required}
                error={err}
              >
                <SelectItem value="__empty__">None</SelectItem>
                {areaOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </FieldSelect>
            );
          }

          if (field.type === "number") {
            const err = errors[field.key];
            return (
              <div key={field.key} className="w-full space-y-1.5">
                {field.label_key && (
                  <Label htmlFor={field.key}>{field.label_key}</Label>
                )}
                <Input
                  id={field.key}
                  type="number"
                  value={(val ?? field.default_value ?? "") as string | number}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateField(field.key, v === "" ? undefined : Number(v));
                  }}
                  required={useNativeRequired && required}
                  aria-invalid={!!err}
                  className="w-full"
                />
                {err && <p className="text-sm text-destructive">{err}</p>}
              </div>
            );
          }

          if (field.type === "date" || field.type === "datetime") {
            const err = errors[field.key];
            const raw = (val ?? field.default_value ?? "") as string;
            const d = raw && dayjs(raw).isValid() ? dayjs(raw) : null;
            const inputValue =
              field.type === "datetime"
                ? d?.format("YYYY-MM-DDTHH:mm") ?? ""
                : d?.format("YYYY-MM-DD") ?? "";
            const inputType = field.type === "datetime" ? "datetime-local" : "date";
            return (
              <div key={field.key} className="w-full space-y-1.5">
                {field.label_key && (
                  <Label htmlFor={field.key}>{field.label_key}</Label>
                )}
                <Input
                  id={field.key}
                  type={inputType}
                  value={inputValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v || v.trim() === "") {
                      updateField(field.key, "");
                      return;
                    }
                    const parsed = dayjs(v);
                    updateField(field.key, parsed.isValid() ? parsed.toISOString() : "");
                  }}
                  required={useNativeRequired && required}
                  aria-invalid={!!err}
                  className="w-full"
                />
                {err && (
                  <p className={cn("text-sm", "text-destructive")}>{err}</p>
                )}
              </div>
            );
          }

          if (field.type === "string" && (field.key === "description" || field.input_mode)) {
            const err = errors[field.key];
            const mode: DescriptionInputMode = field.input_mode ?? "text";
            return (
              <DescriptionField
                key={field.key}
                value={(val ?? field.default_value ?? "") as string}
                onChange={(v) => updateField(field.key, v)}
                mode={mode}
                label={field.label_key}
                error={!!err}
                helperText={err}
                rows={mode === "text" ? 4 : 6}
                allowModeSwitch
              />
            );
          }

          const err = errors[field.key];
          return (
            <div key={field.key} className="w-full space-y-1.5">
              {field.label_key && (
                <Label htmlFor={field.key}>{field.label_key}</Label>
              )}
              <Input
                id={field.key}
                value={(val ?? field.default_value ?? "") as string}
                onChange={(e) => updateField(field.key, e.target.value)}
                required={useNativeRequired && required}
                aria-invalid={!!err}
                className="w-full"
              />
              {err && <p className="text-sm text-destructive">{err}</p>}
            </div>
          );
        })}
      </div>
      {!submitExternally && (
        <div className="mt-4 flex justify-end gap-2">
          <Button type="submit" disabled={disabled}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
