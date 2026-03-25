export interface TestStep {
  id: string;
  stepNumber: number;
  action: string;
  expectedResult: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
  actualResult?: string;
  notes?: string;
}

export interface StepResult {
  stepId: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
  actualResult?: string;
  notes?: string;
}

/** Legacy / alternate shape; persisted runs prefer `runMetrics.ts` (`v` + `results`). */
export interface RunMetrics {
  testResults: Record<string, {
    status: 'passed' | 'failed' | 'blocked' | 'not-executed';
    stepResults: StepResult[];
    executedAt?: string;
    executedBy?: string;
  }>;
}
