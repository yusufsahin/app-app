/**
 * Form schema types — metadata-driven form definitions from backend.
 */
export interface VisibleWhenCondition {
  field: string;
  eq?: string | number | boolean;
  in?: (string | number)[];
}

export interface FormFieldSchema {
  key: string;
  type: "string" | "number" | "choice" | "entity_ref";
  label_key: string;
  required?: boolean;
  options?: Array<{ id: string; label: string }>;
  default_value?: unknown;
  order?: number;
  visible_when?: VisibleWhenCondition;
  required_when?: VisibleWhenCondition;
  entity_ref?: "artifact" | "user" | "cycle" | "area";
  allowed_parent_types?: string[];
}

export interface FormSchemaDto {
  entity_type: string;
  context: string;
  fields: FormFieldSchema[];
  artifact_type_options?: Array<{ id: string; label: string }>;
}
