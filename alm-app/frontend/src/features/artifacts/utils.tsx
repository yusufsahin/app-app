/**
 * Shared artifact helpers for ArtifactsPage and subcomponents.
 */
import type { ReactElement } from "react";
import { Bug, FileText } from "lucide-react";
import type { Artifact } from "../../shared/stores/artifactStore";

export const CORE_FIELD_KEYS = new Set(["artifact_type", "parent_id", "title", "description", "assignee_id"]);
export const TITLE_MAX_LENGTH = 500;

/** System root types that cannot be deleted or reparented. */
export const ROOT_ARTIFACT_TYPES = new Set(["root-requirement", "root-quality", "root-defect"]);

export function isRootArtifact(artifact: { artifact_type: string }): boolean {
  return ROOT_ARTIFACT_TYPES.has(artifact.artifact_type);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function getArtifactCellValue(row: Artifact, columnKey: string): string | number | undefined | null {
  if (columnKey === "created_at" || columnKey === "updated_at") {
    const raw = columnKey === "created_at" ? row.created_at : row.updated_at;
    return formatDateTime(raw ?? undefined) || null;
  }
  const knownKeys: (keyof Artifact)[] = ["artifact_key", "artifact_type", "title", "state", "state_reason", "resolution"];
  if (knownKeys.includes(columnKey as keyof Artifact)) {
    const val = row[columnKey as keyof Artifact];
    return val !== undefined && val !== null ? String(val) : null;
  }
  const val = row.custom_fields?.[columnKey];
  return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : null;
}

export function downloadArtifactsCsv(
  artifacts: Artifact[],
  members: { user_id: string; display_name?: string; email?: string }[] = [],
): void {
  const headers = ["Key", "Type", "Title", "Description", "State", "State reason", "Resolution", "Assignee", "Created", "Updated"];
  const rows = artifacts.map((a) => {
    const assignee = a.assignee_id
      ? members.find((m) => m.user_id === a.assignee_id)?.display_name ||
        members.find((m) => m.user_id === a.assignee_id)?.email ||
        a.assignee_id
      : "";
    return [
      escapeCsvCell(a.artifact_key ?? a.id),
      escapeCsvCell(a.artifact_type),
      escapeCsvCell(a.title),
      escapeCsvCell(a.description ?? ""),
      escapeCsvCell(a.state),
      escapeCsvCell(a.state_reason ?? ""),
      escapeCsvCell(a.resolution ?? ""),
      escapeCsvCell(assignee),
      escapeCsvCell(formatDateTime(a.created_at ?? undefined)),
      escapeCsvCell(formatDateTime(a.updated_at ?? undefined)),
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artifacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getArtifactIcon(type: string): ReactElement {
  switch (type) {
    case "defect":
    case "bug":
      return <Bug className="size-4" />;
    case "root-defect":
      return <Bug className="size-4" />;
    case "requirement":
      return <FileText className="size-4" />;
    default:
      return <FileText className="size-4" />;
  }
}

/** Derive valid transitions from manifest workflow */
export function getValidTransitions(
  manifest: { manifest_bundle?: { workflows?: unknown[]; artifact_types?: Array<{ id: string; workflow_id?: string }> } } | null | undefined,
  artifactType: string,
  currentState: string,
): string[] {
  const bundle = manifest?.manifest_bundle;
  if (!bundle) return [];
  const workflows = (bundle.workflows ?? []) as Array<{ id: string; transitions?: Array<{ from: string; to: string }> }>;
  const artifactTypes = bundle.artifact_types ?? [];
  const at = artifactTypes.find((a) => a.id === artifactType);
  if (!at?.workflow_id) return [];
  const wf = workflows.find((w) => w.id === at.workflow_id);
  if (!wf?.transitions) return [];
  return wf.transitions
    .filter((t) => t.from === currentState)
    .map((t) => t.to);
}

export interface ArtifactNode extends Artifact {
  children: ArtifactNode[];
}

const ROOT_ORDER: Record<string, number> = {
  "root-requirement": 0,
  "root-quality": 1,
  "root-defect": 2,
};

export function buildArtifactTree(artifacts: Artifact[]): ArtifactNode[] {
  const byId = new Map<string, ArtifactNode>();
  for (const a of artifacts) {
    byId.set(a.id, { ...a, children: [] });
  }
  const roots: ArtifactNode[] = [];
  for (const a of artifacts) {
    const node = byId.get(a.id)!;
    if (!a.parent_id) {
      roots.push(node);
    } else {
      const parent = byId.get(a.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  roots.sort(
    (a, b) =>
      (ROOT_ORDER[a.artifact_type] ?? 2) - (ROOT_ORDER[b.artifact_type] ?? 2)
  );
  return roots;
}
