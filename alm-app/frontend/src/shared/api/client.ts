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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const problem = error.response.data as ProblemDetail;
      return Promise.reject(problem);
    }
    return Promise.reject(error);
  },
);
