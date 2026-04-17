/** Parity with frontend/src/shared/types/formSchema.ts */
export type DescriptionInputMode = 'text' | 'richtext' | 'markdown';
export type SchemaLookupKind = 'user' | 'tag' | 'cycle' | 'area' | 'team' | 'artifact';

export interface VisibleWhenCondition {
  field: string;
  eq?: string | number | boolean;
  in?: (string | number)[];
}

export interface SchemaLookup {
  kind: SchemaLookupKind;
  multi?: boolean;
  label_field?: string | null;
  value_field?: string | null;
}

export interface FormFieldSchema {
  key: string;
  type: 'string' | 'number' | 'choice' | 'entity_ref' | 'date' | 'datetime' | 'tag_list';
  label_key: string;
  required?: boolean;
  options?: Array<{ id: string; label: string }>;
  default_value?: unknown;
  order?: number;
  visible_when?: VisibleWhenCondition;
  required_when?: VisibleWhenCondition;
  entity_ref?: 'artifact' | 'user' | 'cycle' | 'area' | 'team';
  allowed_parent_types?: string[];
  editable?: boolean;
  surfaces?: string[];
  lookup?: SchemaLookup | null;
  write_target?: 'root' | 'custom_field' | null;
  input_mode?: DescriptionInputMode;
}

export interface FormSchemaDto {
  entity_type: string;
  context: string;
  fields: FormFieldSchema[];
  artifact_type_options?: Array<{ id: string; label: string }>;
}
