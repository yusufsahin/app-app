/**
 * Metadata-driven form — renders form fields from FormSchemaDto.
 */
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useMemo } from "react";
import type { FormFieldSchema, FormSchemaDto } from "../../types/formSchema";

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
  /** When true, form does not render submit button (parent provides it in DialogActions) */
  submitExternally?: boolean;
  /** Artifacts for parent_id entity_ref */
  parentArtifacts?: ParentArtifactOption[];
  /** Map artifactType -> allowed parent types (from manifest). When set, parent list is filtered. */
  artifactTypeParentMap?: Record<string, string[]>;
  /** Users for assignee_id entity_ref */
  userOptions?: UserOption[];
  /** Cycle nodes for cycle_node_id entity_ref (planning) */
  cycleOptions?: Array<{ id: string; label: string }>;
  /** Area nodes for area_node_id entity_ref (planning) */
  areaOptions?: Array<{ id: string; label: string }>;
  /** Field-level validation errors (key -> message) */
  errors?: Record<string, string>;
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
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visibleFields.map((field) => {
          const val = values[field.key];
          const required = isRequired(field);

          if (field.type === "choice") {
            const err = errors[field.key];
            return (
              <FormControl key={field.key} fullWidth required={required} error={!!err}>
                <InputLabel>{field.label_key}</InputLabel>
                <Select
                  value={val ?? field.default_value ?? ""}
                  label={field.label_key}
                  onChange={(e) => updateField(field.key, e.target.value)}
                >
                  {field.options?.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
                {err && <FormHelperText>{err}</FormHelperText>}
              </FormControl>
            );
          }

          if (field.type === "entity_ref" && field.entity_ref === "artifact") {
            const err = errors[field.key];
            return (
              <FormControl key={field.key} fullWidth required={required} error={!!err}>
                <InputLabel>{field.label_key}</InputLabel>
                <Select
                  value={val ?? ""}
                  label={field.label_key}
                  onChange={(e) =>
                    updateField(field.key, (e.target.value as string) || null)
                  }
                >
                  <MenuItem value="">None (root)</MenuItem>
                  {parentOptions.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.title} ({a.artifact_type})
                    </MenuItem>
                  ))}
                </Select>
                {err && <FormHelperText>{err}</FormHelperText>}
              </FormControl>
            );
          }

          if (field.type === "entity_ref" && field.entity_ref === "user") {
            const err = errors[field.key];
            return (
              <FormControl key={field.key} fullWidth required={required} error={!!err}>
                <InputLabel>{field.label_key}</InputLabel>
                <Select
                  value={val ?? ""}
                  label={field.label_key}
                  onChange={(e) =>
                    updateField(field.key, (e.target.value as string) || null)
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {userOptions.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.label}
                    </MenuItem>
                  ))}
                </Select>
                {err && <FormHelperText>{err}</FormHelperText>}
              </FormControl>
            );
          }

          if ((field.type === "entity_ref" && field.entity_ref === "cycle") || field.key === "cycle_node_id") {
            const err = errors[field.key];
            const options = cycleOptions;
            return (
              <FormControl key={field.key} fullWidth required={required} error={!!err}>
                <InputLabel>{field.label_key}</InputLabel>
                <Select
                  value={val ?? ""}
                  label={field.label_key}
                  onChange={(e) =>
                    updateField(field.key, (e.target.value as string) || null)
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {options.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
                {err && <FormHelperText>{err}</FormHelperText>}
              </FormControl>
            );
          }

          if ((field.type === "entity_ref" && field.entity_ref === "area") || field.key === "area_node_id") {
            const err = errors[field.key];
            const options = areaOptions;
            return (
              <FormControl key={field.key} fullWidth required={required} error={!!err}>
                <InputLabel>{field.label_key}</InputLabel>
                <Select
                  value={val ?? ""}
                  label={field.label_key}
                  onChange={(e) =>
                    updateField(field.key, (e.target.value as string) || null)
                  }
                >
                  <MenuItem value="">None</MenuItem>
                  {options.map((o) => (
                    <MenuItem key={o.id} value={o.id}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
                {err && <FormHelperText>{err}</FormHelperText>}
              </FormControl>
            );
          }

          if (field.type === "number") {
            const err = errors[field.key];
            return (
              <TextField
                key={field.key}
                fullWidth
                label={field.label_key}
                type="number"
                value={val ?? field.default_value ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField(
                    field.key,
                    v === "" ? undefined : Number(v),
                  );
                }}
                required={required}
                error={!!err}
                helperText={err}
              />
            );
          }

          const err = errors[field.key];
          return (
            <TextField
              key={field.key}
              fullWidth
              label={field.label_key}
              value={val ?? field.default_value ?? ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              multiline={field.key === "description"}
              rows={field.key === "description" ? 3 : undefined}
              required={required}
              error={!!err}
              helperText={err}
            />
          );
        })}
      </Box>
      {!submitExternally && (
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button type="submit" variant="contained" disabled={disabled}>
            {submitLabel}
          </Button>
        </Box>
      )}
    </form>
  );
}
