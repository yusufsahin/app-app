import type { Artifact } from "../../../shared/api/artifactApi";
import { summarizeRunMetricsFromCustomFields } from "./runMetrics";

export type RunQuickFilterId = "all" | "has_failed" | "last_7_days";

export type FilterRunsOptions = {
  text: string;
  quick: RunQuickFilterId;
  /** For tests; default `new Date()` in production. */
  now?: Date;
};

const MS_PER_DAY = 86_400_000;

/** Client-side quick filter + title/key/id text match (case-insensitive). */
export function filterRunsForHub(runs: Artifact[], opts: FilterRunsOptions): Artifact[] {
  const now = opts.now ?? new Date();
  let next = runs;

  switch (opts.quick) {
    case "has_failed":
      next = next.filter((run) => {
        const s = summarizeRunMetricsFromCustomFields(run.custom_fields as Record<string, unknown> | undefined);
        return s.failed > 0;
      });
      break;
    case "last_7_days": {
      const cutoff = now.getTime() - 7 * MS_PER_DAY;
      next = next.filter((run) => {
        if (!run.updated_at) return false;
        const t = new Date(run.updated_at).getTime();
        return !Number.isNaN(t) && t >= cutoff;
      });
      break;
    }
    default:
      break;
  }

  const q = opts.text.trim().toLowerCase();
  if (!q) return next;
  return next.filter((run) => {
    const title = (run.title ?? "").toLowerCase();
    const key = (run.artifact_key ?? "").toLowerCase();
    return title.includes(q) || key.includes(q) || run.id.toLowerCase().includes(q);
  });
}

export type CsvRunRowInput = {
  title: string;
  artifactKey: string;
  id: string;
  state: string;
  updatedAt: string;
  environment: string;
  passed: number;
  failed: number;
  blocked: number;
  notExecuted: number;
  suiteTitle: string;
};

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build CSV text and trigger browser download. */
export function downloadRunsCsv(rows: CsvRunRowInput[], filenameBase: string): void {
  const headers = [
    "title",
    "artifact_key",
    "id",
    "state",
    "updated_at",
    "environment",
    "passed",
    "failed",
    "blocked",
    "not_run",
    "suite",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        csvEscapeCell(r.title),
        csvEscapeCell(r.artifactKey),
        csvEscapeCell(r.id),
        csvEscapeCell(r.state),
        csvEscapeCell(r.updatedAt),
        csvEscapeCell(r.environment),
        String(r.passed),
        String(r.failed),
        String(r.blocked),
        String(r.notExecuted),
        csvEscapeCell(r.suiteTitle),
      ].join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase.replace(/[^\w.-]+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
