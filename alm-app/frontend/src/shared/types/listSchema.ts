/** Column descriptor for metadata-driven list views */
export interface ListColumnSchema {
  key: string;
  label?: string;
  label_key?: string;
  type?: string;
  order?: number;
  sortable?: boolean;
  width?: number;
}

/** Filter descriptor for metadata-driven list views */
export interface ListFilterSchema {
  key: string;
  label?: string;
  label_key?: string;
  type?: string;
  order?: number;
  options?: string[];
}

/** List view schema (columns + filters) */
export interface ListSchemaDto {
  schema_version?: string;
  entity_type: string;
  columns: ListColumnSchema[];
  filters?: ListFilterSchema[] | null;
}
