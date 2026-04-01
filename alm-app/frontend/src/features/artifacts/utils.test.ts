import { describe, it, expect } from "vitest";
import { filterListSchemaForBacklog, isManifestFieldExcludedFromForms } from "./utils";

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

describe("filterListSchemaForBacklog", () => {
  it("keeps only backlog-visible columns", () => {
    const result = filterListSchemaForBacklog({
      entity_type: "artifact",
      columns: [
        { key: "artifact_key", label: "Key", order: 1 },
        { key: "title", label: "Title", order: 2 },
        { key: "severity", label: "Severity", order: 3 },
        { key: "assignee_id", label: "Assignee", order: 4 },
        { key: "updated_at", label: "Updated", order: 5 },
      ],
    });

    expect(result?.columns.map((column) => column.key)).toEqual([
      "artifact_key",
      "title",
      "assignee_id",
      "updated_at",
    ]);
  });

  it("preserves nullish inputs", () => {
    expect(filterListSchemaForBacklog(null)).toBeNull();
    expect(filterListSchemaForBacklog(undefined)).toBeUndefined();
  });
});
