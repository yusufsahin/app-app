import axios from "axios";
import { useAuthStore } from "../stores/authStore";
import type { ProblemDetail } from "./types";

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

/** On 401 (Unauthorized) only: token invalid/expired → logout and redirect to login. 403 = no permission, do not redirect. */
function redirectToLogin(): void {
  useAuthStore.getState().logout();
  if (typeof window === "undefined") return;
  const base =
    window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  if (base) window.location.href = `${base}/login`;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      if (status === 401) {
        redirectToLogin();
        return Promise.reject(error);
      }
      const problem = error.response.data as ProblemDetail;
      return Promise.reject(problem);
    }
    return Promise.reject(error);
  },
);
