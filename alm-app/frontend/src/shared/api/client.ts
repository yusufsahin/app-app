import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/authStore";
import type { ProblemDetail } from "./types";

const MAX_429_RETRIES = 3;

type ConfigWithRateLimitRetry = InternalAxiosRequestConfig & { __rl429Retry?: number };

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function buildAppUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const base =
    window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${base}${path}`;
}

function redirectToLogin(reason?: "session-expired" | "tenant-context"): void {
  useAuthStore.getState().logout();
  if (typeof window === "undefined") return;
  const suffix = reason ? `?reason=${reason}` : "";
  window.location.href = buildAppUrl(`/login${suffix}`);
}

function isTenantContextError(problem: ProblemDetail | undefined, requestUrl: string | undefined): boolean {
  const detail = (problem?.detail ?? "").toLowerCase();
  const normalizedUrl = (requestUrl ?? "").toLowerCase();

  if (
    detail.includes("switch to this organization first") ||
    detail.includes("tenant context") ||
    detail.includes("token type must be 'access'")
  ) {
    return true;
  }

  return normalizedUrl === "/auth/me" || normalizedUrl === "/tenants/" || normalizedUrl === "/tenants";
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const config = error.config as ConfigWithRateLimitRetry | undefined;
      if (status === 429 && config) {
        const attempt = config.__rl429Retry ?? 0;
        if (attempt < MAX_429_RETRIES) {
          const ra = error.response.headers["retry-after"];
          const sec = ra != null && ra !== "" ? Number.parseInt(String(ra), 10) : 1;
          const delay = Math.min(30_000, (Number.isFinite(sec) && sec > 0 ? sec : 1) * 1000);
          config.__rl429Retry = attempt + 1;
          await sleepMs(delay);
          return apiClient(config);
        }
      }
      if (status === 401) {
        redirectToLogin("session-expired");
        return Promise.reject(error);
      }
      const problem = error.response.data as ProblemDetail;
      if (status === 403 && isTenantContextError(problem, error.config?.url)) {
        redirectToLogin("tenant-context");
        return Promise.reject(problem);
      }
      return Promise.reject(problem);
    }
    return Promise.reject(error);
  },
);
