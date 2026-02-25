/**
 * Build a minimal FormSchemaDto from a manifest bundle for live preview.
 * Used on Manifest page to show how the artifact form would look from this manifest.
 */
import type { FormSchemaDto, FormFieldSchema } from "../types/formSchema";

export interface ManifestBundleForPreview {
  workflows?: Array<{ id: string; states?: string[] }>;
  artifact_types?: Array<{ id: string; name?: string; workflow_id?: string; fields?: unknown[] }>;
  defs?: unknown[];
}

/**
 * Build preview form schema from manifest bundle (flat workflows + artifact_types or defs).
 */
export function buildPreviewSchemaFromManifest(bundle: ManifestBundleForPreview): FormSchemaDto {
  const fields: FormFieldSchema[] = [];
  let order = 1;

  const artifactTypes = bundle.artifact_types ?? [];
  const typeOptions = artifactTypes.map((at) => ({ id: at.id, label: at.name ?? at.id }));
  if (typeOptions.length > 0) {
    fields.push({
      key: "artifact_type",
      type: "choice",
      label_key: "Type",
      required: true,
      options: typeOptions,
      order: order++,
    });
  }

  const workflows = bundle.workflows ?? [];
  const allStates = new Set<string>();
  for (const w of workflows) {
    for (const s of w.states ?? []) {
      allStates.add(s);
    }
  }
  if (allStates.size > 0) {
    fields.push({
      key: "state",
      type: "choice",
      label_key: "State",
      required: false,
      options: Array.from(allStates).map((s) => ({ id: s, label: s })),
      order: order++,
    });
  }

  fields.push({
    key: "title",
    type: "string",
    label_key: "Title",
    required: true,
    order: order++,
  });

  fields.push({
    key: "description",
    type: "string",
    label_key: "Description",
    required: false,
    order: order++,
  });

  for (const at of artifactTypes) {
    for (const f of at.fields ?? []) {
      const field = f as { id?: string; name?: string; type?: string; options?: unknown[] };
      const key = field.id ?? `field_${order}`;
      if (fields.some((x) => x.key === key)) continue;
      const label = field.name ?? (typeof field.id === "string" ? field.id : key);
      if (field.type === "choice" && Array.isArray(field.options)) {
        fields.push({
          key,
          type: "choice",
          label_key: label,
          required: false,
          options: field.options.map((o: unknown) => {
            const opt = o as { id?: string; label?: string };
            return { id: String(opt?.id ?? opt), label: String(opt?.label ?? opt?.id ?? opt) };
          }),
          order: order++,
        });
      } else if (field.type === "number") {
        fields.push({
          key,
          type: "number",
          label_key: label,
          required: false,
          order: order++,
        });
      } else {
        fields.push({
          key,
          type: "string",
          label_key: label,
          required: false,
          order: order++,
        });
      }
    }
  }

  return {
    entity_type: "artifact",
    context: "create",
    fields: fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    artifact_type_options: typeOptions,
  };
}
