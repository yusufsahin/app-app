import { describe, expect, it } from "vitest";
import { schemaToGridColumns } from "./schemaToGridColumns";
import type { FormSchemaDto } from "../../types/formSchema";
import type { ListSchemaDto } from "../../types/listSchema";

type StubRow = {
  artifact_type: string;
  title: string;
  custom_fields?: Record<string, unknown>;
};

describe("schemaToGridColumns", () => {
  const listSchema: ListSchemaDto = {
    entity_type: "artifact",
    columns: [
      { key: "title", label: "Title", order: 1 },
      { key: "assignee_id", label: "Assigned to", order: 2 },
      { key: "priority", label: "Priority", order: 2 },
      { key: "story_points", label: "Story points", order: 3 },
      { key: "tags", label: "Tags", order: 4, write_key: "tag_ids" },
    ],
  };

  const formSchema: FormSchemaDto = {
    entity_type: "artifact",
    context: "edit",
    fields: [
      { key: "title", type: "string", label_key: "Title", required: true, editable: true, surfaces: ["form", "tabular"], write_target: "root" },
      {
        key: "assignee_id",
        type: "entity_ref",
        entity_ref: "user",
        label_key: "Assigned to",
        editable: true,
        surfaces: ["form", "tabular"],
        lookup: { kind: "user" },
        write_target: "root",
      },
      {
        key: "priority",
        type: "choice",
        label_key: "Priority",
        visible_when: { field: "artifact_type", in: ["feature", "defect"] },
        options: [{ id: "high", label: "High" }],
        editable: true,
        surfaces: ["form", "tabular"],
        write_target: "custom_field",
      },
      {
        key: "story_points",
        type: "number",
        label_key: "Story points",
        visible_when: { field: "artifact_type", eq: "feature" },
        required_when: { field: "artifact_type", eq: "feature" },
        editable: true,
        surfaces: ["form", "tabular"],
        write_target: "custom_field",
      },
      {
        key: "tag_ids",
        type: "tag_list",
        label_key: "Tags",
        editable: true,
        surfaces: ["form", "tabular"],
        lookup: { kind: "tag", multi: true },
        write_target: "root",
      },
    ],
  };

  const columns = schemaToGridColumns<StubRow>({
    listSchema,
    formSchema,
    getCellValue: (row, columnKey) => {
      if (columnKey === "title") return row.title;
      return (row.custom_fields?.[columnKey] as string | number | null | undefined) ?? null;
    },
    getContextValue: (row, key) => {
      if (key === "artifact_type") return row.artifact_type;
      return row.custom_fields?.[key];
    },
    pinnedColumnKeys: ["title"],
    lookupSources: {
      user: [{ value: "u1", label: "Ada Lovelace" }],
      tag: [{ value: "t1", label: "Platform" }],
    },
  });

  it("marks supported primitive editors as editable by row context", () => {
    const feature: StubRow = { artifact_type: "feature", title: "Feature A", custom_fields: { priority: "high", story_points: 3 } };
    const defect: StubRow = { artifact_type: "defect", title: "Defect A", custom_fields: { priority: "high" } };

    const title = columns.find((column) => column.key === "title");
    const assignee = columns.find((column) => column.key === "assignee_id");
    const priority = columns.find((column) => column.key === "priority");
    const storyPoints = columns.find((column) => column.key === "story_points");

    expect(title?.pinned).toBe(true);
    expect(title?.editorKind).toBe("text");
    expect(assignee?.editorKind).toBe("singleSelect");
    expect(assignee?.isEditable(feature)).toBe(true);
    expect(assignee?.getDisplayValue(feature, "u1")).toBe("Ada Lovelace");
    expect(assignee?.writeTarget).toBe("root");
    expect(priority?.editorKind).toBe("singleSelect");
    expect(priority?.getDisplayValue(feature, "high")).toBe("High");
    expect(priority?.isEditable(feature)).toBe(true);
    expect(priority?.isEditable(defect)).toBe(true);
    expect(storyPoints?.editorKind).toBe("number");
    expect(storyPoints?.isEditable(feature)).toBe(true);
    expect(storyPoints?.isEditable(defect)).toBe(false);
    expect(storyPoints?.validate?.(null, feature)).toBe("Story points is required.");
    expect(storyPoints?.validate?.(null, defect)).toBeNull();
  });

  it("supports tag lists with multi-select text editing", () => {
    const tags = columns.find((column) => column.key === "tags");
    const row: StubRow = { artifact_type: "feature", title: "Feature A", custom_fields: {} };

    expect(tags?.editorKind).toBe("multiSelectText");
    expect(tags?.isSupported).toBe(true);
    expect(tags?.isEditable(row)).toBe(true);
    expect(tags?.fieldKey).toBe("tag_ids");
    expect(tags?.getDisplayValue(row, ["t1", "t2"])).toBe("Platform, t2");
    expect(tags?.toCommitValue?.(["t1", 2], row)).toEqual(["t1", "2"]);
  });

  it("uses write_key to bind list columns to form fields and falls back safely for unsupported values", () => {
    const tags = columns.find((column) => column.key === "tags");
    const assignee = columns.find((column) => column.key === "assignee_id");
    const row: StubRow = {
      artifact_type: "feature",
      title: "Feature A",
      custom_fields: { priority: "high" },
    };

    expect(tags?.fieldKey).toBe("tag_ids");
    expect(tags?.getRawValue(row)).toBeNull();
    expect(assignee?.getDisplayValue(row, "u-missing")).toBe("");
    expect(assignee?.getOptions?.(row)).toEqual([{ value: "u1", label: "Ada Lovelace" }]);
  });
});
