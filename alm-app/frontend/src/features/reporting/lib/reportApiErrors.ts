import type { ProblemDetail } from "../../../shared/api/types";

/** True when the rejected value is an RFC7807 problem with the given HTTP status. */
export function isApiErrorStatus(error: unknown, status: number): boolean {
  if (!error || typeof error !== "object") return false;
  const s = (error as ProblemDetail).status;
  return typeof s === "number" && s === status;
}

/** Resolves FastAPI / RFC7807 problem `detail` or a fallback string. */
export function getReportApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "detail" in error) {
    const d = (error as ProblemDetail).detail;
    if (typeof d === "string" && d.trim()) return d;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
