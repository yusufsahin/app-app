import { describe, it, expect } from "vitest";
import { getReportApiErrorMessage, isApiErrorStatus } from "./reportApiErrors";

describe("isApiErrorStatus", () => {
  it("matches RFC7807-shaped error", () => {
    expect(isApiErrorStatus({ status: 404, detail: "gone" }, 404)).toBe(true);
    expect(isApiErrorStatus({ status: 404, detail: "gone" }, 500)).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(isApiErrorStatus(null, 404)).toBe(false);
    expect(isApiErrorStatus(undefined, 404)).toBe(false);
    expect(isApiErrorStatus(new Error("x"), 404)).toBe(false);
  });
});

describe("getReportApiErrorMessage", () => {
  it("uses detail when present", () => {
    expect(getReportApiErrorMessage({ detail: "Exact problem" }, "fallback")).toBe("Exact problem");
  });

  it("uses fallback when detail missing", () => {
    expect(getReportApiErrorMessage({}, "fallback")).toBe("fallback");
  });
});
