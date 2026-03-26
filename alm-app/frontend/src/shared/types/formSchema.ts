/**
 * Form schema types — metadata-driven form definitions from backend.
 */
export interface VisibleWhenCondition {
  field: string;
  eq?: string | number | boolean;
  in?: (string | number)[];
}

/** For string/description fields: "text" (plain), "richtext" (WYSIWYG/HTML), or "markdown". */
export type DescriptionInputMode = "text" | "richtext" | "markdown";

export interface FormFieldSchema {
  key: string;
  type: "string" | "number" | "choice" | "entity_ref" | "date" | "datetime";
  label_key: string;
  required?: boolean;
  options?: Array<{ id: string; label: string }>;
  default_value?: unknown;
  order?: number;
  visible_when?: VisibleWhenCondition;
  required_when?: VisibleWhenCondition;
  entity_ref?: "artifact" | "user" | "cycle" | "area";
  allowed_parent_types?: string[];
  /** For description/string fields: render as plain text, rich text (WYSIWYG), or markdown editor. Default "text". */
  input_mode?: DescriptionInputMode;
}

export interface FormSchemaDto {
  entity_type: string;
  context: string;
  fields: FormFieldSchema[];
  artifact_type_options?: Array<{ id: string; label: string }>;
}
