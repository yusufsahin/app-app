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
