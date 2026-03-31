export interface TestStep {
  id: string;
  stepNumber: number;
  name: string;
  description: string;
  expectedResult: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
  actualResult?: string;
  notes?: string;
}

/** Reusable block: reference another test-case’s steps (ALM “Call to Test”). */
export interface TestPlanStepCall {
  kind: 'call';
  id: string;
  stepNumber: number;
  calledTestCaseId: string;
  /** Optional title cache for display when the artifact is not loaded. */
  calledTitle?: string;
  /** Merge into execution param map for this call subtree (preorder); root row still wins on same keys. */
  paramOverrides?: Record<string, string>;
}

export type TestPlanEntry = TestStep | TestPlanStepCall;

export function isTestPlanCall(entry: TestPlanEntry): entry is TestPlanStepCall {
  return (entry as TestPlanStepCall).kind === 'call';
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
  actualResult?: string;
  notes?: string;
  linkedDefectIds?: string[];
  attachmentIds?: string[];
  attachmentNames?: string[];
  lastEvidenceAt?: string | null;
  expectedResultSnapshot?: string;
  stepNameSnapshot?: string;
  stepNumber?: number;
}
