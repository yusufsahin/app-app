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
  /** True when a GitHub webhook secret is stored; value is never returned in settings. */
  scm_webhook_github_secret_configured?: boolean;
  /** True when a GitLab webhook token is stored; value is never returned in settings. */
  scm_webhook_gitlab_secret_configured?: boolean;
  /** True when an Azure DevOps webhook token is stored; value is never returned in settings. */
  scm_webhook_azuredevops_secret_configured?: boolean;
  /** True when a CI deploy webhook secret is stored; value is never returned in settings. */
  deploy_webhook_secret_configured?: boolean;
}

export interface DashboardStats {
  projects: number;
  artifacts: number;
  tasks: number;
  openDefects: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
