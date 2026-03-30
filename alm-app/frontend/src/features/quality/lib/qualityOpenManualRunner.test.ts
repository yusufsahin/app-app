/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MANUAL_RUNNER_WINDOW_NAME,
  openManualRunnerInNewWindow,
} from "./qualityOpenManualRunner";

describe("openManualRunnerInNewWindow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens URL with popout=1 and default window name and features", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(window, "location", "get").mockReturnValue({
      origin: "https://app.example",
    } as Location);

    openManualRunnerInNewWindow("o", "p", "550e8400-e29b-41d4-a716-446655440000");

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, name, features] = openSpy.mock.calls[0] as [string, string, string];
    expect(url).toBe(
      "https://app.example/o/p/quality/runs/550e8400-e29b-41d4-a716-446655440000/execute?popout=1",
    );
    expect(name).toBe(MANUAL_RUNNER_WINDOW_NAME);
    expect(features).toContain("width=520");
    expect(features).toContain("noopener");
  });

  it("merges extra query on top of popout", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(window, "location", "get").mockReturnValue({
      origin: "https://x",
    } as Location);

    openManualRunnerInNewWindow("a", "b", "550e8400-e29b-41d4-a716-446655440000", {
      test: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    });

    const url = (openSpy.mock.calls[0] as [string])[0];
    expect(url).toContain("popout=1");
    expect(url).toContain("test=6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  });

  it("uses custom features string when provided", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(window, "location", "get").mockReturnValue({
      origin: "https://x",
    } as Location);

    openManualRunnerInNewWindow("a", "b", "550e8400-e29b-41d4-a716-446655440000", undefined, "width=400");

    expect((openSpy.mock.calls[0] as [string, string, string])[2]).toBe("width=400");
  });
});
