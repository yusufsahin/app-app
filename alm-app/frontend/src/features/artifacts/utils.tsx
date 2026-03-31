/**
 * Shared artifact helpers for ArtifactsPage and subcomponents.
 */
import type { ReactElement } from "react";
import {
  Bug,
  CheckCircle2,
  CircleDot,
  FileText,
  Folder,
  FolderKanban,
  Layers,
  List,
  ListChecks,
  Play,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { Artifact } from "../../shared/stores/artifactStore";
import type { ListColumnSchema } from "../../shared/types/listSchema";
import type { ManifestTreeRoot } from "../../shared/lib/manifestTreeRoots";
import { formatDateTime as formatDateTimeShared } from "../../shared/utils/formatDateTime";

export const formatDateTime = formatDateTimeShared;

export const CORE_FIELD_KEYS = new Set(["artifact_type", "parent_id", "title", "description", "assignee_id"]);
export const TITLE_MAX_LENGTH = 500;

/** Manifest `artifact_types[].fields[]` — omit from metadata-driven forms (e.g. app-managed JSON). */
export function isManifestFieldExcludedFromForms(field: unknown): boolean {
  if (!field || typeof field !== "object") return false;
  const o = field as Record<string, unknown>;
  return Boolean(o.exclude_from_form_schema ?? o.excludeFromFormSchema);
}

const DEFAULT_SYSTEM_ROOT_TYPES = new Set(["root-requirement", "root-quality", "root-defect"]);

type ManifestBundleLike = {
  system_roots?: unknown[];
  defs?: unknown[];
  artifact_types?: Array<{ id?: string; icon?: string }>;
};

/** Resolve system root artifact type ids from manifest (same rules as backend). */
export function getSystemRootArtifactTypes(bundle: ManifestBundleLike | null | undefined): Set<string> {
  if (!bundle) return new Set(DEFAULT_SYSTEM_ROOT_TYPES);
  const explicit = bundle.system_roots;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return new Set(explicit.map((x) => String(x).trim()).filter(Boolean));
  }
  const fromDefs = new Set<string>();
  for (const d of bundle.defs ?? []) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    if (o.kind !== "ArtifactType") continue;
    const id = o.id;
    if (!id) continue;
    const flags = o.flags as Record<string, unknown> | undefined;
    if (o.is_system_root || flags?.is_system_root) fromDefs.add(String(id));
  }
  if (fromDefs.size > 0) return fromDefs;
  return new Set(DEFAULT_SYSTEM_ROOT_TYPES);
}

export function isRootArtifact(
  artifact: { artifact_type: string },
  bundleOrRoots?: ManifestBundleLike | Set<string> | null,
): boolean {
  const roots =
    bundleOrRoots instanceof Set ? bundleOrRoots : getSystemRootArtifactTypes(bundleOrRoots ?? undefined);
  return roots.has(artifact.artifact_type);
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function humanizeKey(key: string): string {
  if (!key) return "";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getArtifactCellValue(row: Artifact, columnKey: string): string | number | undefined | null {
  if (columnKey === "tags") {
    const t = row.tags;
    if (!t?.length) return null;
    return t.map((x) => x.name).join(", ");
  }
  if (columnKey === "created_at" || columnKey === "updated_at") {
    const raw = columnKey === "created_at" ? row.created_at : row.updated_at;
    return formatDateTime(raw ?? undefined) || null;
  }
  const knownKeys: (keyof Artifact)[] = [
    "artifact_key",
    "artifact_type",
    "title",
    "state",
    "state_reason",
    "resolution",
    "assignee_id",
    "parent_id",
    "cycle_node_id",
    "area_node_id",
    "area_path_snapshot",
    "rank_order",
  ];
  if (knownKeys.includes(columnKey as keyof Artifact)) {
    const val = row[columnKey as keyof Artifact];
    if (val === undefined || val === null) return null;
    return String(val);
  }
  const val = row.custom_fields?.[columnKey];
  return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : null;
}

function csvCellForColumn(
  row: Artifact,
  columnKey: string,
  members: { user_id: string; display_name?: string; email?: string }[],
): string {
  if (columnKey === "assignee_id") {
    const id = row.assignee_id;
    if (!id) return "";
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || id;
  }
  const v = getArtifactCellValue(row, columnKey);
  return v === null || v === undefined ? "" : String(v);
}

/** Export CSV using list schema column order/labels when provided; otherwise a built-in default column set. */
export function downloadArtifactsCsv(
  artifacts: Artifact[],
  members: { user_id: string; display_name?: string; email?: string }[] = [],
  listColumns?: ListColumnSchema[] | null,
): void {
  let headers: string[];
  let keys: string[];

  if (listColumns && listColumns.length > 0) {
    const sorted = [...listColumns].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    keys = sorted.map((c) => c.key);
    headers = sorted.map((c) => c.label?.trim() || humanizeKey(c.key));
  } else {
    keys = [
      "artifact_key",
      "artifact_type",
      "title",
      "description",
      "state",
      "state_reason",
      "resolution",
      "assignee_id",
      "created_at",
      "updated_at",
    ];
    headers = [
      "Key",
      "Type",
      "Title",
      "Description",
      "State",
      "State reason",
      "Resolution",
      "Assignee",
      "Created",
      "Updated",
    ];
  }

  const rows = artifacts.map((a) =>
    keys.map((k) => escapeCsvCell(csvCellForColumn(a, k, members))).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = `artifacts-${new Date().toISOString().slice(0, 10)}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

const LUCIDE_BY_ICON_ID: Record<string, LucideIcon> = {
  "file-text": FileText,
  file: FileText,
  bug: Bug,
  "list-checks": ListChecks,
  list: List,
  "check-circle": CheckCircle2,
  "check-circle-2": CheckCircle2,
  "circle-dot": CircleDot,
  layers: Layers,
  target: Target,
};

export function getArtifactIcon(
  type: string,
  bundle?: { artifact_types?: Array<{ id?: string; icon?: string }> } | null,
): ReactElement {
  const at = bundle?.artifact_types?.find((a) => a.id === type);
  const iconId = at?.icon?.trim().toLowerCase();
  if (iconId && LUCIDE_BY_ICON_ID[iconId]) {
    const Icon = LUCIDE_BY_ICON_ID[iconId]!;
    return <Icon className="size-4" />;
  }
  switch (type) {
    case "defect":
      return <Bug className="size-4" />;
    case "root-defect":
      return <Bug className="size-4" />;
    case "requirement":
      return <FileText className="size-4" />;
    case "quality-folder":
      return <Folder className="size-4 text-blue-500" />;
    case "test-suite":
      return <FolderKanban className="size-4 text-purple-500" />;
    case "test-run":
      return <Play className="size-4 text-green-500" />;
    case "test-campaign":
      return <Target className="size-4 text-orange-500" />;
    case "test-case":
      return <ListChecks className="size-4 text-blue-600" />;
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

const DEFAULT_ROOT_ORDER: Record<string, number> = {
  "root-requirement": 0,
  "root-quality": 1,
  "root-defect": 2,
};

/** Order top-level tree roots by manifest ``tree_roots`` (then unknown roots last). */
export function buildArtifactTree(artifacts: Artifact[], treeRoots?: ManifestTreeRoot[] | null): ArtifactNode[] {
  const orderByType: Record<string, number> = { ...DEFAULT_ROOT_ORDER };
  if (treeRoots?.length) {
    treeRoots.forEach((r, i) => {
      orderByType[r.root_artifact_type] = i;
    });
  }

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
  roots.sort((a, b) => (orderByType[a.artifact_type] ?? 999) - (orderByType[b.artifact_type] ?? 999));
  return roots;
}
