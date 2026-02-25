/**
 * Unit tests for ProjectSwitcher utils: getPinnedKey, getPinnedSlugs, setPinnedSlugs, getProjectSegment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPinnedKey,
  getPinnedSlugs,
  setPinnedSlugs,
  getProjectSegment,
  PROJECT_SEGMENTS,
} from "./projectSwitcherUtils";

describe("projectSwitcherUtils", () => {
  describe("getPinnedKey", () => {
    it("returns org-scoped key", () => {
      expect(getPinnedKey("acme")).toBe("alm_pinned_projects_acme");
      expect(getPinnedKey("org-1")).toBe("alm_pinned_projects_org-1");
    });
  });

  describe("getPinnedSlugs / setPinnedSlugs", () => {
    const storage: Record<string, string> = {};
    const fakeLocalStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    };

    beforeEach(() => {
      Object.keys(storage).forEach((k) => delete storage[k]);
      vi.stubGlobal("window", { localStorage: fakeLocalStorage });
      vi.stubGlobal("localStorage", fakeLocalStorage);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("returns empty array when no org or no storage", () => {
      expect(getPinnedSlugs(undefined)).toEqual([]);
      expect(getPinnedSlugs("acme")).toEqual([]);
    });

    it("returns and persists pinned slugs", () => {
      setPinnedSlugs("acme", ["p1", "p2"]);
      expect(getPinnedSlugs("acme")).toEqual(["p1", "p2"]);
    });

    it("filters non-strings and caps at MAX_PINNED", () => {
      setPinnedSlugs("acme", ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
      expect(getPinnedSlugs("acme").length).toBe(8);
    });

    it("returns empty on invalid JSON", () => {
      storage[getPinnedKey("acme")] = "not json";
      expect(getPinnedSlugs("acme")).toEqual([]);
    });

    it("filters non-string array elements", () => {
      storage[getPinnedKey("acme")] = JSON.stringify(["p1", 2, null, "p3"]);
      expect(getPinnedSlugs("acme")).toEqual(["p1", "p3"]);
    });
  });

  describe("getProjectSegment", () => {
    it("returns null for path without 3 segments", () => {
      expect(getProjectSegment("")).toBeNull();
      expect(getProjectSegment("/org")).toBeNull();
      expect(getProjectSegment("/org/proj")).toBeNull();
    });

    it("returns segment when third part is a project page", () => {
      expect(getProjectSegment("/org/proj/artifacts")).toBe("artifacts");
      expect(getProjectSegment("/org/proj/board")).toBe("board");
      expect(getProjectSegment("/org/proj/manifest")).toBe("manifest");
      expect(getProjectSegment("/org/proj/planning")).toBe("planning");
      expect(getProjectSegment("/org/proj/automation")).toBe("automation");
    });

    it("returns null when third part is not a project segment", () => {
      expect(getProjectSegment("/org/proj/settings")).toBeNull();
      expect(getProjectSegment("/org/proj/other")).toBeNull();
    });

    it("handles leading/trailing slashes", () => {
      expect(getProjectSegment("org/proj/artifacts")).toBe("artifacts");
    });
  });

  describe("PROJECT_SEGMENTS", () => {
    it("includes expected segments", () => {
      expect(PROJECT_SEGMENTS).toContain("manifest");
      expect(PROJECT_SEGMENTS).toContain("planning");
      expect(PROJECT_SEGMENTS).toContain("artifacts");
      expect(PROJECT_SEGMENTS).toContain("board");
      expect(PROJECT_SEGMENTS).toContain("automation");
      expect(PROJECT_SEGMENTS).toHaveLength(5);
    });
  });
});
