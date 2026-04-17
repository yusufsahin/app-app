/**
 * Shared manifest bundle types (parity with web manifestApi.ts).
 */
export interface ManifestBundle {
  workflows?: Array<{
    id: string;
    states?: unknown[];
    resolution_target_states?: string[];
    transitions?: Array<{ from: string; to: string }>;
  }>;
  artifact_types?: Array<{
    id: string;
    name?: string;
    workflow_id?: string;
    fields?: unknown[];
    icon?: string;
    is_system_root?: boolean;
  }>;
  link_types?: Array<{
    id?: string;
    name?: string;
    label?: string;
    direction?: string;
    cardinality?: string;
    from_types?: string[];
    to_types?: string[];
    description?: string;
  }>;
  tree_roots?: Array<{
    tree_id?: string;
    id?: string;
    root_artifact_type?: string;
    root_type?: string;
    label?: string;
  }>;
  task_workflow_id?: string;
  search_locale?: string;
  policies?: unknown[];
  [key: string]: unknown;
}

export interface ManifestResponse {
  manifest_bundle: ManifestBundle;
  template_name: string;
  template_slug: string;
  version: string;
}
