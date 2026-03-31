import { describe, it, expect } from "vitest";
import type { TestStep } from "../../types";
import { normalizeTestSteps, parseTestSteps } from "../testSteps";

describe("testSteps utilities", () => {
  describe("normalizeTestSteps", () => {
    it("should correctly renumber steps", () => {
      const steps: TestStep[] = [
        {
          id: "1",
          stepNumber: 10,
          name: "A",
          description: "",
          expectedResult: "",
          status: "not-executed",
        },
        {
          id: "2",
          stepNumber: 5,
          name: "B",
          description: "",
          expectedResult: "",
          status: "not-executed",
        },
      ];
      const result = normalizeTestSteps(steps);
      expect(result).toHaveLength(2);
      expect(result[0]!.stepNumber).toBe(1);
      expect(result[1]!.stepNumber).toBe(2);
    });
  });

  describe("parseTestSteps", () => {
    it("should return only inline steps, ignoring calls", () => {
      const data = [
        {
          kind: "step" as const,
          id: "s1",
          name: "Step 1",
          description: "",
          expectedResult: "",
          status: "not-executed" as const,
        },
        { kind: "call" as const, id: "c1", calledTestCaseId: "tc-2" },
      ];
      const result = parseTestSteps(data);
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Step 1");
    });
  });
});
