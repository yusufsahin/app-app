import { describe, it, expect, vi } from "vitest";
import type { NavigateFunction } from "react-router-dom";
import {
  navigateToManualExecution,
  navigateToRunDetails,
  parseRunOverviewTabParam,
} from "./qualityOpenManualRunner";

describe("navigateToManualExecution", () => {
  it("navigates to runs with runExecute when not on runs page", () => {
    const navigate = vi.fn();
    navigateToManualExecution(navigate as unknown as NavigateFunction, "o", "p", "550e8400-e29b-41d4-a716-446655440000");
    expect(navigate).toHaveBeenCalledWith(
      {
        pathname: "/o/p/quality/runs",
        search: "?runExecute=550e8400-e29b-41d4-a716-446655440000&runTab=runner",
      },
      { replace: false },
    );
    const first = navigate.mock.calls[0]![0] as { search: string };
    expect(new URLSearchParams(first.search).get("runOverviewTab")).toBe(null);
  });

  it("uses only run modal query params (no merge with prior URL state)", () => {
    const navigate = vi.fn();
    navigateToManualExecution(navigate as unknown as NavigateFunction, "a", "b", "550e8400-e29b-41d4-a716-446655440000", {
      test: "t1",
      step: "s1",
      replace: true,
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]![0] as { pathname: string; search: string };
    expect(call.pathname).toBe("/a/b/quality/runs");
    const sp = new URLSearchParams(call.search.replace(/^\?/, ""));
    expect(sp.get("under")).toBe(null);
    expect(sp.get("artifact")).toBe(null);
    expect(sp.get("foo")).toBe(null);
    expect(sp.get("runExecute")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sp.get("runTab")).toBe("runner");
    expect(sp.get("runOverviewTab")).toBe(null);
    expect(sp.get("runTest")).toBe("t1");
    expect(sp.get("runStep")).toBe("s1");
    expect(navigate.mock.calls[0]![1]).toEqual({ replace: true });
  });
});

describe("navigateToRunDetails", () => {
  it("navigates to details view in modal", () => {
    const navigate = vi.fn();
    navigateToRunDetails(
      navigate as unknown as NavigateFunction,
      "o",
      "p",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]![0] as { pathname: string; search: string };
    expect(call.pathname).toBe("/o/p/quality/runs");
    const sp = new URLSearchParams(call.search.replace(/^\?/, ""));
    expect(sp.get("artifact")).toBe(null);
    expect(sp.get("under")).toBe(null);
    expect(sp.get("runExecute")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sp.get("runTab")).toBe(null);
    expect(sp.get("runOverviewTab")).toBe(null);
  });

  it("sets runTab when runTab option is not summary", () => {
    const navigate = vi.fn();
    navigateToRunDetails(
      navigate as unknown as NavigateFunction,
      "o",
      "p",
      "550e8400-e29b-41d4-a716-446655440000",
      { runTab: "steps" },
    );
    const call = navigate.mock.calls[0]![0] as { search: string };
    const sp = new URLSearchParams(call.search.replace(/^\?/, ""));
    expect(sp.get("runTab")).toBe("steps");
  });
});

describe("parseRunOverviewTabParam", () => {
  it("returns summary for null or unknown", () => {
    expect(parseRunOverviewTabParam(null)).toBe("summary");
    expect(parseRunOverviewTabParam("nope")).toBe("summary");
  });

  it("returns valid tabs", () => {
    expect(parseRunOverviewTabParam("linked")).toBe("linked");
  });
});
