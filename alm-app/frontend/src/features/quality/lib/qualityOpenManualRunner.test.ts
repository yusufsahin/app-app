import { describe, it, expect, vi } from "vitest";
import type { NavigateFunction } from "react-router-dom";
import { navigateToManualExecution, navigateToRunDetails } from "./qualityOpenManualRunner";

describe("navigateToManualExecution", () => {
  it("navigates to runs with runExecute when not on runs page", () => {
    const navigate = vi.fn();
    navigateToManualExecution(navigate as unknown as NavigateFunction, "o", "p", "550e8400-e29b-41d4-a716-446655440000");
    expect(navigate).toHaveBeenCalledWith(
      {
        pathname: "/o/p/quality/runs",
        search: "?runExecute=550e8400-e29b-41d4-a716-446655440000&runView=execution",
      },
      { replace: false },
    );
  });

  it("merges with existing runs query when location is runs path", () => {
    const navigate = vi.fn();
    navigateToManualExecution(navigate as unknown as NavigateFunction, "a", "b", "550e8400-e29b-41d4-a716-446655440000", {
      location: {
        pathname: "/a/b/quality/runs",
        search: "?under=u1&artifact=art1&foo=bar",
      },
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
    expect(sp.get("foo")).toBe("bar");
    expect(sp.get("runExecute")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sp.get("runView")).toBe("execution");
    expect(sp.get("runTest")).toBe("t1");
    expect(sp.get("runStep")).toBe("s1");
    expect(navigate.mock.calls[0]![1]).toEqual({ replace: true });
  });

  it("navigates to details view in modal", () => {
    const navigate = vi.fn();
    navigateToRunDetails(
      navigate as unknown as NavigateFunction,
      "o",
      "p",
      "550e8400-e29b-41d4-a716-446655440000",
      {
        location: { pathname: "/o/p/quality/runs", search: "?artifact=a1&under=u1" },
      },
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    const call = navigate.mock.calls[0]![0] as { pathname: string; search: string };
    expect(call.pathname).toBe("/o/p/quality/runs");
    const sp = new URLSearchParams(call.search.replace(/^\?/, ""));
    expect(sp.get("artifact")).toBe(null);
    expect(sp.get("under")).toBe(null);
    expect(sp.get("runExecute")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(sp.get("runView")).toBe("overview");
  });
});
