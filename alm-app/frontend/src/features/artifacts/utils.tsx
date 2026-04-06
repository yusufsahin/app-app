/**
 * Shared artifact helpers for backlog and artifact-focused surfaces.
 */
import type { ReactElement } from "react";
import {
  Bug,
  CheckCircle2,
  CircleDot,
  ClipboardList,
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
import type { ListSchemaDto } from "../../shared/types/listSchema";
import type { ManifestTreeRoot } from "../../shared/lib/manifestTreeRoots";
import { formatDateTime as formatDateTimeShared } from "../../shared/utils/formatDateTime";
import { getValidTransitionsFromBundle, type ManifestBundleForTransitions } from "../../shared/lib/workflowTransitions";

export const formatDateTime = formatDateTimeShared;

export const CORE_FIELD_KEYS = new Set(["artifact_type", "parent_id", "title", "description", "assignee_id"]);
export const TITLE_MAX_LENGTH = 500;
export const BACKLOG_VISIBLE_COLUMN_KEYS = new Set([
  "artifact_key",
  "artifact_type",
  "title",
  "state",
  "priority",
  "story_points",
  "assignee_id",
  "tags",
  "updated_at",
]);

export function filterListSchemaForBacklog(
  schema: ListSchemaDto | null | undefined,
): ListSchemaDto | null | undefined {
  if (!schema) return schema;
  return {
    ...schema,
    columns: schema.columns.filter((column) => BACKLOG_VISIBLE_COLUMN_KEYS.has(column.key)),
  };
}

/** Manifest `artifact_types[].fields[]` — omit from metadata-driven forms (e.g. app-managed JSON). */
export function isManifestFieldExcludedFromForms(field: unknown): boolean {
  if (!field || typeof field !== "object") return false;
  const o = field as Record<string, unknown>;
  return Boolean(o.exclude_from_form_schema ?? o.excludeFromFormSchema);
}

/** Keep in sync with backend `DEFAULT_SYSTEM_ROOT_TYPES` when manifest omits `system_roots`. */
const DEFAULT_SYSTEM_ROOT_TYPES = new Set([
  "root-requirement",
  "root-quality",
  "root-testsuites",
  "root-defect",
]);

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

/** Manifest bundle slice used to resolve `child_types` for an artifact type. */
export type ManifestBundleForChildTypes = {
  artifact_types?: Array<{
    id?: string;
    child_types?: unknown;
    childTypes?: unknown;
    allow_create_children?: unknown;
    allows_children?: unknown;
    flags?: { allow_create_children?: unknown; allows_children?: unknown };
  }>;
  defs?: unknown[];
};

/** When false, manifest forbids creating new child artifacts under this parent type (UI + should match BE). */
function manifestParentDeniesChildCreation(
  bundle: ManifestBundleForChildTypes | null | undefined,
  parentTypeId: string,
): boolean {
  if (!bundle || !parentTypeId) return false;
  const fromFlat = bundle.artifact_types?.find((t) => t.id === parentTypeId);
  if (fromFlat) {
    const flags = fromFlat.flags;
    if (fromFlat.allow_create_children === false || fromFlat.allows_children === false) return true;
    if (flags?.allow_create_children === false || flags?.allows_children === false) return true;
  }
  for (const d of bundle.defs ?? []) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    if (o.kind !== "ArtifactType") continue;
    if (String(o.id) !== parentTypeId) continue;
    const flags = o.flags as Record<string, unknown> | undefined;
    if (o.allow_create_children === false || o.allows_children === false) return true;
    if (flags?.allow_create_children === false || flags?.allows_children === false) return true;
    break;
  }
  return false;
}

function normalizeManifestChildTypeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

/**
 * Ordered list of child artifact type ids allowed under `parentTypeId` per manifest (`child_types`).
 * Reads flattened `artifact_types` first, then `defs` ArtifactType entries.
 */
export function getManifestChildTypeIdsForParent(
  bundle: ManifestBundleForChildTypes | null | undefined,
  parentTypeId: string,
): string[] {
  if (!bundle || !parentTypeId) return [];
  if (manifestParentDeniesChildCreation(bundle, parentTypeId)) return [];
  const fromFlat = bundle.artifact_types?.find((t) => t.id === parentTypeId);
  if (fromFlat) {
    const ids = normalizeManifestChildTypeList(fromFlat.child_types ?? fromFlat.childTypes);
    if (ids.length > 0) return ids;
  }
  for (const d of bundle.defs ?? []) {
    if (!d || typeof d !== "object") continue;
    const o = d as Record<string, unknown>;
    if (o.kind !== "ArtifactType") continue;
    if (String(o.id) !== parentTypeId) continue;
    return normalizeManifestChildTypeList(o.child_types ?? o.childTypes);
  }
  return [];
}

/** True when manifest allows creating at least one child type under this parent artifact type. */
export function manifestArtifactTypeAllowsChildren(
  bundle: ManifestBundleForChildTypes | null | undefined,
  parentTypeId: string,
): boolean {
  return getManifestChildTypeIdsForParent(bundle, parentTypeId).length > 0;
}

/** BFS over manifest `child_types` starting at `moduleRootType` (inclusive). */
export function collectManifestReachableTypeIds(
  bundle: ManifestBundleForChildTypes | null | undefined,
  moduleRootType: string,
): Set<string> {
  const reachable = new Set<string>();
  if (!bundle || !moduleRootType) return reachable;
  const queue = [moduleRootType];
  reachable.add(moduleRootType);
  while (queue.length > 0) {
    const p = queue.shift()!;
    for (const c of getManifestChildTypeIdsForParent(bundle, p)) {
      if (!reachable.has(c)) {
        reachable.add(c);
        queue.push(c);
      }
    }
  }
  return reachable;
}

/**
 * Non-system artifact types that may appear as children somewhere under a tree module, in manifest order.
 * Used to narrow backlog toolbar "New work item" to the active tree.
 */
export function getToolbarCreatableArtifactTypeIds(
  bundle: ManifestBundleForChildTypes | null | undefined,
  moduleRootArtifactType: string,
  systemRoots: Set<string>,
): string[] {
  if (!bundle || !moduleRootArtifactType) return [];
  const reachable = collectManifestReachableTypeIds(bundle, moduleRootArtifactType);
  const creatable = new Set<string>();
  for (const p of reachable) {
    for (const t of getManifestChildTypeIdsForParent(bundle, p)) {
      if (systemRoots.has(t)) continue;
      if (t.startsWith("root-")) continue;
      creatable.add(t);
    }
  }
  const order = (bundle.artifact_types ?? []).map((x) => x.id).filter(Boolean) as string[];
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (creatable.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  for (const id of creatable) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
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
    "cycle_id",
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
  el.download = `backlog-${new Date().toISOString().slice(0, 10)}.csv`;
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

type ArtifactTypeBundle = { artifact_types?: Array<{ id?: string; icon?: string; name?: string }> } | null | undefined;

/**
 * User-visible type label: manifest `artifact_types[].name` when set.
 * Legacy manifest/API type id `requirement` (leaf under epic→feature) maps to "User story" when no name is set.
 */
export function getArtifactTypeDisplayLabel(type: string, bundle?: ArtifactTypeBundle): string {
  const raw = bundle?.artifact_types?.find((a) => a.id === type)?.name?.trim();
  if (raw) return raw;
  if (!type) return "Work item";
  if (type === "requirement") return "User story";
  if (type === "workitem" || type === "issue") return "Work item";
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getArtifactIcon(
  type: string,
  bundle?: ArtifactTypeBundle,
): ReactElement {
  const at = bundle?.artifact_types?.find((a) => a.id === type);
  const iconId = at?.icon?.trim().toLowerCase();
  if (iconId && LUCIDE_BY_ICON_ID[iconId]) {
    const Icon = LUCIDE_BY_ICON_ID[iconId]!;
    return <Icon className="size-4" />;
  }
  switch (type) {
    case "epic":
      return <Layers className="size-4 text-violet-600" />;
    case "feature":
      return <CircleDot className="size-4 text-blue-600" />;
    case "workitem":
    case "issue":
      return <ClipboardList className="size-4 text-sky-600" />;
    case "defect":
      return <Bug className="size-4" />;
    case "root-defect":
      return <Bug className="size-4" />;
    /* Leaf backlog item: API/manifest id is often `requirement`; same icon as user-story. */
    case "requirement":
    case "user-story":
    case "user_story":
      return <FileText className="size-4 text-slate-600" />;
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
  return getValidTransitionsFromBundle(
    (manifest?.manifest_bundle as ManifestBundleForTransitions | undefined) ?? null,
    artifactType,
    currentState,
  );
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
