import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import type { ProblemDetail } from '../types/api';
import { queryClient } from '../queryClient';
import { useSessionStore } from '../store/sessionStore';
import { API_V1_BASE } from './config';
import { fetchRefreshedTokens } from './tokenRefresh';

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshTokens(): Promise<boolean> {
  const { refreshToken, accessToken, setTokens } = useSessionStore.getState();
  if (!refreshToken) return false;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const pair = await fetchRefreshedTokens(refreshToken, accessToken);
      await setTokens(pair.access_token, pair.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export const api = axios.create({
  baseURL: `${API_V1_BASE}`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const headers = axios.AxiosHeaders.from(config.headers ?? {});
  if (headers.get('Authorization')) {
    config.headers = headers;
    return config;
  }
  const token = useSessionStore.getState().accessToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers = headers;
  return config;
});

function isTenantContextError(problem: ProblemDetail | undefined, requestUrl: string | undefined): boolean {
  const detail = (problem?.detail ?? '').toLowerCase();
  const normalizedUrl = (requestUrl ?? '').toLowerCase();
  if (
    detail.includes('switch to this organization first') ||
    detail.includes('tenant context') ||
    detail.includes("token type must be 'access'")
  ) {
    return true;
  }
  return (
    normalizedUrl === '/auth/me' || normalizedUrl === '/tenants/' || normalizedUrl === '/tenants'
  );
}

function isAuthPublicPath(url: string | undefined): boolean {
  const u = (url ?? '').toLowerCase();
  return (
    u.includes('/auth/login') ||
    u.includes('/auth/register') ||
    u.includes('/auth/refresh') ||
    u.includes('/auth/switch-tenant') ||
    u.includes('/auth/complete-registration')
  );
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ProblemDetail>) => {
    const status = error.response?.status;
    const config = error.config as RetryableConfig | undefined;

    if (status === 401 && config && !isAuthPublicPath(config.url) && !config._retry) {
      const refreshed = await tryRefreshTokens();
      if (refreshed) {
        config._retry = true;
        return api.request(config);
      }
    }

    if (status === 401) {
      await useSessionStore.getState().logout();
      queryClient.clear();
      router.replace('/login');
      return Promise.reject(error);
    }
    const problem = error.response?.data;
    if (status === 403 && isTenantContextError(problem, error.config?.url)) {
      await useSessionStore.getState().logout();
      queryClient.clear();
      router.replace('/login');
      return Promise.reject(problem ?? error);
    }
    return Promise.reject(problem ?? error);
  },
);

export function isProblemDetail(e: unknown): e is ProblemDetail {
  return (
    typeof e === 'object' &&
    e !== null &&
    'detail' in e &&
    typeof (e as ProblemDetail).detail === 'string'
  );
}

/** User-facing message: RFC 7807 body, axios network/timeout, or `Error.message`. */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (isProblemDetail(e)) return e.detail;
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (data !== undefined && isProblemDetail(data)) return data.detail;
    const code = (e.code ?? '').toUpperCase();
    if (code === 'ECONNABORTED' || (e.message ?? '').toLowerCase().includes('timeout')) {
      return 'Request timed out. Try again.';
    }
    if (!e.response) {
      return 'Could not reach the server. Check EXPO_PUBLIC_API_URL and your network.';
    }
  }
  if (e instanceof Error && e.message.trim()) return e.message;
  return fallback;
}
