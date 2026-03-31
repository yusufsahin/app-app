import { describe, it, expect, vi } from "vitest";
import type { TestPlanEntry } from "../../types";
import { parseTestPlan, expandTestPlan, serializeTestPlan } from "../testPlan";

describe('testPlan utilities', () => {
    describe('parseTestPlan', () => {
        it('should parse valid JSON string', () => {
            const json = JSON.stringify([
                {
                    kind: 'step',
                    id: 's1',
                    name: 'Step 1',
                    description: '',
                    expectedResult: '',
                    status: 'not-executed',
                },
            ]);
            const result = parseTestPlan(json);
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ name: 'Step 1', stepNumber: 1 });
        });

        it('should handle call rows', () => {
            const data = [{ kind: 'call', calledTestCaseId: 'tc-123', id: 'c1' }];
            const result = parseTestPlan(data);
            expect(result[0]).toMatchObject({ kind: 'call', calledTestCaseId: 'tc-123' });
        });

        it('should return empty array for invalid JSON', () => {
            expect(parseTestPlan('invalid-json')).toEqual([]);
        });
    });

    describe('expandTestPlan', () => {
        it('should expand inline steps', async () => {
            const entries: TestPlanEntry[] = [
                {
                    id: "s1",
                    name: "Step 1",
                    stepNumber: 1,
                    description: "",
                    expectedResult: "",
                    status: "not-executed",
                },
            ];
            const result = await expandTestPlan(entries, async () => null);
            expect(result.steps).toHaveLength(1);
            expect(result.steps[0]!.name).toBe("Step 1");
        });

        it('should expand nested calls', async () => {
            const entries: TestPlanEntry[] = [
                { kind: "call", id: "c1", calledTestCaseId: "tc-2", stepNumber: 1 },
            ];
            const loadCallee = vi.fn().mockResolvedValue([
                {
                    kind: "step" as const,
                    id: "inner-1",
                    name: "Inner step",
                    description: "",
                    expectedResult: "",
                    status: "not-executed" as const,
                },
            ]);

            const result = await expandTestPlan(entries, loadCallee);
            expect(result.steps).toHaveLength(1);
            expect(result.steps[0]!.id).toBe("call:c1:inner-1");
            expect(result.steps[0]!.name).toBe("Inner step");
        });

        it('should detect circular calls', async () => {
            const entries: TestPlanEntry[] = [
                { kind: "call", id: "c1", calledTestCaseId: "tc-1", stepNumber: 1 },
            ];
            const loadCallee = vi.fn().mockResolvedValue([
                { kind: "call", id: "c2", calledTestCaseId: "tc-1", stepNumber: 1 },
            ]);

            const result = await expandTestPlan(entries, loadCallee);
            expect(result.error).toMatch(/Circular test call detected/);
        });
    });

    describe('serializeTestPlan', () => {
        it('should correctly serialize entries', () => {
            const entries = [
                {
                    id: 's1',
                    name: 'Step',
                    stepNumber: 1,
                    description: '',
                    expectedResult: 'OK',
                    status: 'not-executed' as const,
                },
                { kind: 'call' as const, id: 'c1', calledTestCaseId: 'tc-2', stepNumber: 2 },
            ];
            const result = serializeTestPlan(entries);
            expect(result[0]).toMatchObject({ kind: 'step', name: 'Step' });
            expect(result[1]).toMatchObject({ kind: 'call', calledTestCaseId: 'tc-2' });
        });
    });
});
