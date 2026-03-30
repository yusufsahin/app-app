import { describe, it, expect } from "vitest";
import { isManifestFieldExcludedFromForms } from "./utils";

describe("isManifestFieldExcludedFromForms", () => {
  it("returns false for non-objects", () => {
    expect(isManifestFieldExcludedFromForms(null)).toBe(false);
    expect(isManifestFieldExcludedFromForms(undefined)).toBe(false);
    expect(isManifestFieldExcludedFromForms("x")).toBe(false);
  });

  it("respects snake_case flag", () => {
    expect(isManifestFieldExcludedFromForms({ id: "x", exclude_from_form_schema: true })).toBe(true);
    expect(isManifestFieldExcludedFromForms({ id: "x", exclude_from_form_schema: false })).toBe(false);
  });

  it("respects camelCase flag", () => {
    expect(isManifestFieldExcludedFromForms({ id: "x", excludeFromFormSchema: true })).toBe(true);
  });
});
