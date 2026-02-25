/**
 * E1: Unit tests for workflow rule API constants and shape.
 */
import { describe, it, expect } from "vitest";
import { TRIGGER_EVENT_TYPES } from "./workflowRuleApi";

describe("workflowRuleApi", () => {
  describe("TRIGGER_EVENT_TYPES", () => {
    it("exposes expected trigger event types", () => {
      expect(TRIGGER_EVENT_TYPES).toHaveLength(2);
      expect(TRIGGER_EVENT_TYPES[0]).toEqual({
        value: "artifact_created",
        label: "Artifact created",
      });
      expect(TRIGGER_EVENT_TYPES[1]).toEqual({
        value: "artifact_state_changed",
        label: "Artifact state changed",
      });
    });

    it("has unique values", () => {
      const values = TRIGGER_EVENT_TYPES.map((t) => t.value);
      expect(new Set(values).size).toBe(values.length);
    });

    it("values are non-empty strings", () => {
      for (const t of TRIGGER_EVENT_TYPES) {
        expect(typeof t.value).toBe("string");
        expect(t.value.length).toBeGreaterThan(0);
        expect(typeof t.label).toBe("string");
        expect(t.label.length).toBeGreaterThan(0);
      }
    });
  });
});
