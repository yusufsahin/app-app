export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  correlation_id: string;
  trace_id?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string;
  status?: string | null;
  settings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  tier: string;
  roles: string[];
}

export interface TenantMember {
  user_id: string;
  email: string;
  display_name: string;
  roles: {
    id: string;
    name: string;
    slug: string;
    is_system: boolean;
    hierarchy_level: number;
  }[];
  joined_at: string;
}

export interface ArtifactTagBrief {
  id: string;
  name: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  artifact_type: string;
  title: string;
  description: string;
  state: string;
  assignee_id: string | null;
  parent_id: string | null;
  custom_fields?: Record<string, unknown>;
  artifact_key?: string | null;
  state_reason?: string | null;
  resolution?: string | null;
  rank_order?: number | null;
  cycle_id?: string | null;
  area_node_id?: string | null;
  area_path_snapshot?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  stale_traceability?: boolean;
  tags?: ArtifactTagBrief[];
  allowed_actions?: string[];
}

export interface ArtifactsListResult {
  items: Artifact[];
  total: number;
  allowed_actions?: string[];
}
