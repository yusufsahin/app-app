/**
 * E1: Unit tests for buildPreviewSchemaFromManifest (manifest → form schema for preview).
 */
import { describe, it, expect } from "vitest";
import { buildPreviewSchemaFromManifest } from "./manifestPreviewSchema";

describe("buildPreviewSchemaFromManifest", () => {
  it("returns artifact entity schema with title and description for empty bundle", () => {
    const schema = buildPreviewSchemaFromManifest({});
    expect(schema.entity_type).toBe("artifact");
    expect(schema.context).toBe("create");
    const keys = schema.fields.map((f) => f.key);
    expect(keys).toContain("title");
    expect(keys).toContain("description");
    expect(schema.fields.find((f) => f.key === "title")?.required).toBe(true);
    expect(schema.fields.find((f) => f.key === "description")?.required).toBe(false);
  });

  it("adds artifact_type choice when artifact_types present", () => {
    const schema = buildPreviewSchemaFromManifest({
      artifact_types: [
        { id: "req", name: "Requirement" },
        { id: "task", name: "Task" },
      ],
    });
    const typeField = schema.fields.find((f) => f.key === "artifact_type");
    expect(typeField).toBeDefined();
    expect(typeField?.type).toBe("choice");
    expect(typeField?.required).toBe(true);
    expect(typeField?.options).toEqual([
      { id: "req", label: "Requirement" },
      { id: "task", label: "Task" },
    ]);
    expect(schema.artifact_type_options).toEqual([
      { id: "req", label: "Requirement" },
      { id: "task", label: "Task" },
    ]);
  });

  it("adds state choice from workflow states", () => {
    const schema = buildPreviewSchemaFromManifest({
      workflows: [
        { id: "basic", states: ["new", "active", "resolved", "closed"] },
      ],
    });
    const stateField = schema.fields.find((f) => f.key === "state");
    expect(stateField).toBeDefined();
    expect(stateField?.type).toBe("choice");
    expect(stateField?.options?.map((o) => o.id).sort()).toEqual(["active", "closed", "new", "resolved"]);
  });

  it("merges states from multiple workflows", () => {
    const schema = buildPreviewSchemaFromManifest({
      workflows: [
        { id: "a", states: ["draft", "done"] },
        { id: "b", states: ["open", "done"] },
      ],
    });
    const stateField = schema.fields.find((f) => f.key === "state");
    expect(stateField?.options?.length).toBe(3);
    expect(stateField?.options?.map((o) => o.id).sort()).toEqual(["done", "draft", "open"]);
  });

  it("adds custom fields from artifact_types[].fields", () => {
    const schema = buildPreviewSchemaFromManifest({
      artifact_types: [
        {
          id: "req",
          name: "Requirement",
          fields: [
            { id: "priority", name: "Priority", type: "choice", options: [{ id: "high", label: "High" }] },
            { id: "effort", name: "Effort", type: "number" },
            { id: "notes", name: "Notes" },
          ],
        },
      ],
    });
    const priority = schema.fields.find((f) => f.key === "priority");
    expect(priority?.type).toBe("choice");
    expect(priority?.options).toEqual([{ id: "high", label: "High" }]);
    const effort = schema.fields.find((f) => f.key === "effort");
    expect(effort?.type).toBe("number");
    const notes = schema.fields.find((f) => f.key === "notes");
    expect(notes?.type).toBe("string");
  });

  it("sorts fields by order", () => {
    const schema = buildPreviewSchemaFromManifest({
      artifact_types: [{ id: "r", name: "R" }],
      workflows: [{ id: "w", states: ["s1"] }],
    });
    const orders = schema.fields.map((f) => f.order ?? 0);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1] ?? 0);
    }
  });
});
