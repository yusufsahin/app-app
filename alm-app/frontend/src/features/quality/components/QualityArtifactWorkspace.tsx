import { useEffect, useId, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { Pencil, PlayCircle, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import {
  buildArtifactListParams,
  downloadArtifactImportTemplate,
  exportArtifactsFile,
  importArtifactsFile,
  useArtifact,
  useArtifacts,
  useCreateArtifact,
  useDeleteArtifact,
  type ArtifactImportMode,
  type ArtifactImportResult,
  type Artifact,
} from "../../../shared/api/artifactApi";
import {
  sortOutgoingRelationships,
  useArtifactRelationships,
  useCreateArtifactRelationship,
  useDeleteArtifactRelationship,
} from "../../../shared/api/relationshipApi";
import { getDeclaredTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "../../../shared/components/ui";
import { QualityFolderTreeNav } from "./QualityFolderTreeNav";
import { QualityTestCaseDetailPanels } from "./QualityTestCaseDetailPanels";
import { SuiteTestLinkModal } from "./SuiteTestLinkModal";
import { StartSuiteRunDialog } from "./StartSuiteRunDialog";
import { CampaignSuiteCommandDialog } from "./CampaignSuiteCommandDialog";
import { useLastExecutionStatusBatch, lastExecutionStatusMap } from "../hooks/useLastExecutionStatusBatch";
import { SuiteRecentRunsCard } from "./SuiteRecentRunsCard";
import { TestLastStatusBadge } from "./TestLastStatusBadge";
import { SuiteIncludedTestsReorderList } from "./SuiteIncludedTestsReorderList";
import { useStartSuiteRun } from "../hooks/useStartSuiteRun";
import { qualityPath, qualityCatalogPath } from "../../../shared/utils/appPaths";
import type { BreadcrumbSegment } from "../../../shared/components/Layout";
import type { TestPlanEntry } from "../types";
import { parseTestPlan, normalizeTestPlan, serializeTestPlan } from "../lib/testPlan";
import { parseTestParams, serializeTestParams, normalizeTestParams } from "../lib/testParams";
import { modalApi } from "../../../shared/modal/modalApi";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../../shared/api/client";
import { navigateToManualExecution } from "../lib/qualityOpenManualRunner";

interface LinkConfig {
  linkType: string;
  targetType: string;
  title: string;
}

interface QualityArtifactWorkspaceProps {
  artifactType: string;
  treeId?: string;
  linkTargetTreeId?: string;
  rootArtifactType?: string;
  folderArtifactType?: string;
  pageLabel: string;
  description: string;
  createCta: string;
  emptyLabel: string;
  linkConfig?: LinkConfig;
  runExecute?: boolean;
  enableStepsEditor?: boolean;
  allowFolderCreate?: boolean;
  /** Catalog-style layout: single detail pane driven by tree selection only (no Items list). */
  explorerMode?: "list-and-detail" | "tree-detail";
}

function isUuid(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Quality artifacts that appear as leaves under the selected folder type in explorer. */
const QUALITY_EXPLORER_LEAF_TYPES = new Set([
  "test-case",
  "test-suite",
  "test-run",
  "test-campaign",
]);

export default function QualityArtifactWorkspace({
  artifactType,
  treeId = "quality",
  linkTargetTreeId,
  rootArtifactType = "root-quality",
  folderArtifactType = "quality-folder",
  pageLabel,
  description,
  createCta,
  emptyLabel,
  linkConfig,
  runExecute = false,
  enableStepsEditor = false,
  allowFolderCreate = false,
  explorerMode = "list-and-detail",
}: QualityArtifactWorkspaceProps) {
  const { t } = useTranslation("quality");
  const workspaceSubfoldersSwitchId = useId();
  const queryClient = useQueryClient();
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [suiteCommandOpen, setSuiteCommandOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<ArtifactImportMode>("upsert");
  const [importValidateOnly, setImportValidateOnly] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ArtifactImportResult | null>(null);
  const [ioBusy, setIoBusy] = useState(false);
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const selectedUnder = isUuid(searchParams.get("under")) ? searchParams.get("under") : null;
  const selectedArtifactId = isUuid(searchParams.get("artifact")) ? searchParams.get("artifact") : null;
  const treeRoots = useMemo(
    () => getDeclaredTreeRootsFromManifestBundle(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const hasTargetTree = treeRoots.some((t) => t.tree_id === treeId);
  const isTestCaseWorkspace = artifactType === "test-case";
  const showTestCaseIoActions = isTestCaseWorkspace;
  const showExplorerLeaves = QUALITY_EXPLORER_LEAF_TYPES.has(artifactType);
  /** Manifest `tree_id: testsuites` — product: Campaign; technical ids unchanged (`root-testsuites`, `testsuite-folder`). */
  const isCampaignTree = treeId === "testsuites";
  /** Catalog groups vs Campaign collections. */
  const tws = (key: string, options?: Record<string, unknown>) =>
    isCampaignTree ? t(`campaignWorkspace.${key}`, options) : t(`workspace.${key}`, options);
  const tmFolder = (key: "createFolderTitle" | "renameFolderTitle" | "deleteFolderTitle") =>
    isCampaignTree ? t(`campaignModals.${key}`) : t(`modals.${key}`);
  const tmMove = (key: "moveToFolderTitle" | "moveToFolderDescription" | "moveToFolderPlaceholder") =>
    isCampaignTree ? t(`campaignModals.${key}`) : t(`modals.${key}`);

  const newLeafMenuLabel = useMemo(() => {
    switch (artifactType) {
      case "test-case":
        return t("tree.newTestCase");
      case "test-suite":
        return t("tree.newSuite");
      case "test-run":
        return t("tree.newRun");
      case "test-campaign":
        return t("tree.newCampaign");
      default:
        return t("tree.newItem");
    }
  }, [artifactType, t]);

  const { data: folderData } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "title",
    "asc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    treeId,
    true,
  );
  const rootQualityId = useMemo(
    () => (folderData?.items ?? []).find((a) => a.artifact_type === rootArtifactType)?.id ?? null,
    [folderData?.items, rootArtifactType],
  );

  const listQuery = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    artifactType,
    "updated_at",
    "desc",
    undefined,
    200,
    0,
    false,
    undefined,
    undefined,
    undefined,
    treeId,
    false,
    selectedUnder,
  );

  const createArtifact = useCreateArtifact(orgSlug, project?.id);
  const deleteArtifact = useDeleteArtifact(orgSlug, project?.id);
  const startSuiteRun = useStartSuiteRun(orgSlug, project?.id, projectSlug);
  const selectedArtifactQuery = useArtifact(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const linksQuery = useArtifactRelationships(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const createLink = useCreateArtifactRelationship(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const deleteLink = useDeleteArtifactRelationship(orgSlug, project?.id, selectedArtifactId ?? undefined);

  const testCaseExportParams = buildArtifactListParams({
    typeFilter: "test-case",
    sortBy: "updated_at",
    sortOrder: "desc",
    tree: treeId,
    parentId: selectedUnder,
  });

  const handleWorkspaceExport = useCallback(
    async (format: "csv" | "xlsx") => {
      if (!orgSlug || !project?.id || !isTestCaseWorkspace) return;
      setIoBusy(true);
      try {
        await exportArtifactsFile(orgSlug, project.id, {
          ...testCaseExportParams,
          format,
          scope: "testcases",
        });
        toast.success(`Exported test cases as ${format.toUpperCase()}.`);
      } catch (error) {
        const detail = (error as { detail?: string } | undefined)?.detail;
        toast.error(detail || "Failed to export test cases.");
      } finally {
        setIoBusy(false);
      }
    },
    [isTestCaseWorkspace, orgSlug, project?.id, testCaseExportParams],
  );

  const handleTemplateDownload = useCallback(
    async (format: "csv" | "xlsx") => {
      if (!orgSlug || !project?.id || !isTestCaseWorkspace) return;
      setIoBusy(true);
      try {
        await downloadArtifactImportTemplate(orgSlug, project.id, { format, scope: "testcases" });
        toast.success(`Downloaded test case ${format.toUpperCase()} template.`);
      } catch (error) {
        const detail = (error as { detail?: string } | undefined)?.detail;
        toast.error(detail || "Failed to download template.");
      } finally {
        setIoBusy(false);
      }
    },
    [isTestCaseWorkspace, orgSlug, project?.id],
  );

  const handleImportSubmit = useCallback(async () => {
    if (!orgSlug || !project?.id || !importFile || !isTestCaseWorkspace) return;
    setIoBusy(true);
    try {
      const result = await importArtifactsFile(orgSlug, project.id, {
        file: importFile,
        scope: "testcases",
        mode: importMode,
        validateOnly: importValidateOnly,
      });
      setImportResult(result);
      const successCount = result.created_count + result.updated_count + result.validated_count;
      toast[ result.failed_count > 0 ? "warning" : "success" ](
        `${importValidateOnly ? "Validation" : "Import"} finished: ${successCount} succeeded, ${result.failed_count} failed.`,
      );
      if (!importValidateOnly && result.failed_count === 0) {
        await listQuery.refetch();
      }
    } catch (error) {
      const detail = (error as { detail?: string } | undefined)?.detail;
      toast.error(detail || "Failed to import test cases.");
    } finally {
      setIoBusy(false);
    }
  }, [
    importFile,
    importMode,
    importValidateOnly,
    isTestCaseWorkspace,
    listQuery,
    orgSlug,
    project?.id,
  ]);

  const linkTargetsQuery = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    linkConfig?.targetType,
    "title",
    "asc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    linkTargetTreeId ?? treeId,
    false,
  );

  const [targetArtifactId, setTargetArtifactId] = useState("");
  const [moveArtifactId, setMoveArtifactId] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState("");
  const [suiteLinkModalOpen, setSuiteLinkModalOpen] = useState(false);
  const [workspaceIncludeSubfolders, setWorkspaceIncludeSubfolders] = useState(false);
  const selectedArtifact = selectedArtifactQuery.data;

  const showSuiteExecution = Boolean(
    isCampaignTree &&
      artifactType === "test-suite" &&
      linkConfig?.linkType === "suite_includes_test" &&
      selectedArtifact?.artifact_type === "test-suite",
  );
  const suiteLinkModalVisible =
    suiteLinkModalOpen || (showSuiteExecution && Boolean(selectedArtifactId) && searchParams.get("addTests") === "1");

  /** Campaign + execution flag: main content is only the centered suite link card (no grid / execution table). */
  const suiteLinkOnlyCentered = Boolean(showSuiteExecution);

  const canUpdateSelectedArtifact = !!(
    (selectedArtifact as Artifact & { allowed_actions?: string[] } | undefined)?.allowed_actions?.includes("update")
  );
  const listItems = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const folderItems = useMemo(() => folderData?.items ?? [], [folderData?.items]);
  const allFolderNodes = useMemo(
    () => folderItems.filter((a) => a.artifact_type === folderArtifactType),
    [folderItems, folderArtifactType],
  );
  const descendantFolderIds = useMemo(() => {
    if (!selectedUnder) return new Set<string>();
    const childrenByParent = new Map<string, string[]>();
    for (const f of allFolderNodes) {
      if (!f.parent_id) continue;
      const list = childrenByParent.get(f.parent_id) ?? [];
      list.push(f.id);
      childrenByParent.set(f.parent_id, list);
    }
    const allIds = new Set<string>([selectedUnder]);
    const stack = [selectedUnder];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        if (allIds.has(child)) continue;
        allIds.add(child);
        stack.push(child);
      }
    }
    return allIds;
  }, [allFolderNodes, selectedUnder]);

  const workspaceItems = useMemo(() => {
    const isTestCaseWorkspace = artifactType === "test-case";
    if (!isTestCaseWorkspace || !selectedUnder) return listItems;
    if (!workspaceIncludeSubfolders) {
      return folderItems.filter(
        (item) =>
          item.parent_id === selectedUnder &&
          (item.artifact_type === folderArtifactType || item.artifact_type === "test-case"),
      );
    }
    return folderItems.filter((item) => {
      if (item.artifact_type === folderArtifactType) {
        return item.parent_id === selectedUnder;
      }
      return item.artifact_type === "test-case" && !!item.parent_id && descendantFolderIds.has(item.parent_id);
    });
  }, [
    artifactType,
    descendantFolderIds,
    folderArtifactType,
    folderItems,
    listItems,
    selectedUnder,
    workspaceIncludeSubfolders,
  ]);

  const catalogTestIdsForLastExec = useMemo(
    () =>
      artifactType === "test-case"
        ? workspaceItems
            .filter((i) => i.artifact_type === "test-case")
            .map((i) => i.id)
            .slice(0, 200)
        : [],
    [artifactType, workspaceItems],
  );
  const { data: lastExecItems } = useLastExecutionStatusBatch(orgSlug, project?.id, catalogTestIdsForLastExec);
  const lastExecById = useMemo(() => lastExecutionStatusMap(lastExecItems), [lastExecItems]);

  const isTreeDetail = explorerMode === "tree-detail";

  const underParam = searchParams.get("under");

  useEffect(() => {
    if (!isTreeDetail || !selectedArtifactId) return;
    if (selectedArtifactQuery.isPending || !selectedArtifact) return;
    if (selectedArtifact.artifact_type !== artifactType) return;
    const parentId = selectedArtifact.parent_id;
    if (!parentId || !isUuid(parentId)) return;
    if (underParam === parentId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("under", parentId);
        next.set("artifact", selectedArtifactId);
        return next;
      },
      { replace: true },
    );
  }, [
    isTreeDetail,
    selectedArtifactId,
    selectedArtifact,
    selectedArtifactQuery.isPending,
    artifactType,
    underParam,
    setSearchParams,
  ]);

  /** Scope row for current `under` (folder, root-quality, etc.) — not a leaf selection. */
  const selectedScopeRow = useMemo(() => {
    if (!selectedUnder) return undefined;
    return folderItems.find((a) => a.id === selectedUnder);
  }, [selectedUnder, folderItems]);

  const directChildStats = useMemo(() => {
    if (!selectedUnder) return { groups: 0, cases: 0 };
    let groups = 0;
    let cases = 0;
    for (const item of folderItems) {
      if (item.parent_id !== selectedUnder) continue;
      if (item.artifact_type === folderArtifactType) groups += 1;
      else if (item.artifact_type === artifactType) cases += 1;
    }
    return { groups, cases };
  }, [selectedUnder, folderItems, folderArtifactType, artifactType]);

  /** Collections tree: folder summary line matches leaf type (suite vs run vs batch campaign). */
  const testsuitesCollectionSummaryKey = useMemo(() => {
    if (artifactType === "test-run") return "groupDirectChildrenSummaryRuns" as const;
    if (artifactType === "test-campaign") return "groupDirectChildrenSummaryCampaigns" as const;
    return "groupDirectChildrenSummarySuites" as const;
  }, [artifactType]);

  const testsuitesCollectionNextStepsKey = useMemo(() => {
    if (artifactType === "test-run") return "collectionNextStepsRun" as const;
    if (artifactType === "test-campaign") return "collectionNextStepsBatchCampaign" as const;
    return "collectionNextStepsSuite" as const;
  }, [artifactType]);

  const patchArtifactMutation = useMutation({
    mutationFn: async ({ artifactId, body }: { artifactId: string; body: Record<string, unknown> }) => {
      if (!orgSlug || !project?.id) throw new Error("Missing project");
      const { data } = await apiClient.patch<Artifact>(
        `/orgs/${orgSlug}/projects/${project.id}/artifacts/${artifactId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { artifactId }) => {
      void queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts"] });
      void queryClient.invalidateQueries({
        queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", artifactId],
      });
    },
  });

  const qualityFolderOptions = useMemo(
    () =>
      (folderData?.items ?? [])
        .filter((a) => a.artifact_type === folderArtifactType)
        .slice()
        .sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }),
        ),
    [folderData?.items, folderArtifactType],
  );

  const linkTargets = useMemo(() => {
    const allTargets = linkTargetsQuery.data?.items ?? [];
    if (!selectedArtifactId) return allTargets;
    return allTargets.filter((a) => a.id !== selectedArtifactId);
  }, [linkTargetsQuery.data?.items, selectedArtifactId]);

  const selectedLinks = useMemo(() => {
    if (!linkConfig || !selectedArtifactId) return [];
    return (linksQuery.data ?? []).filter(
      (l) => l.relationship_type === linkConfig.linkType && l.source_artifact_id === selectedArtifactId,
    );
  }, [linkConfig, linksQuery.data, selectedArtifactId]);

  const orderedSuiteLinks = useMemo(() => {
    if (!linkConfig || !selectedArtifactId) return [];
    return sortOutgoingRelationships(linksQuery.data ?? [], selectedArtifactId, linkConfig.linkType);
  }, [linkConfig, linksQuery.data, selectedArtifactId]);

  const linkedTargetIds = useMemo(() => new Set(selectedLinks.map((l) => l.target_artifact_id)), [selectedLinks]);
  const linkedTargets = linkTargets.filter((a) => linkedTargetIds.has(a.id));
  const availableTargets = linkTargets.filter((a) => !linkedTargetIds.has(a.id));

  const suiteLinkedTargetsById = useMemo(() => {
    const m = new Map<string, Artifact>();
    for (const a of linkedTargets) {
      m.set(a.id, a);
    }
    return m;
  }, [linkedTargets]);

  const catalogBreadcrumbTrail = useMemo((): BreadcrumbSegment[] | undefined => {
    if (artifactType !== "test-case" || !orgSlug || !projectSlug) return undefined;
    const trail: BreadcrumbSegment[] = [
      { label: t("pages.breadcrumbQuality"), to: qualityPath(orgSlug, projectSlug) },
    ];
    const effectiveFolderId =
      selectedUnder ??
      (selectedArtifact?.artifact_type === "test-case" && isUuid(selectedArtifact.parent_id ?? null)
        ? selectedArtifact.parent_id
        : null);
    if (selectedUnder || selectedArtifactId) {
      trail.push({ label: t("pages.catalog"), to: qualityCatalogPath(orgSlug, projectSlug) });
    }
    if (
      selectedArtifactId &&
      selectedArtifact?.artifact_type === "test-case" &&
      effectiveFolderId
    ) {
      const folder = folderItems.find((x) => x.id === effectiveFolderId);
      if (folder?.title) {
        trail.push({ label: folder.title });
      }
    }
    return trail;
  }, [artifactType, orgSlug, projectSlug, selectedUnder, selectedArtifactId, selectedArtifact, folderItems, t]);

  const isTestsuitesExplorerLeaf =
    isCampaignTree &&
    (artifactType === "test-suite" || artifactType === "test-run" || artifactType === "test-campaign");

  const breadcrumbCurrentLabel =
    artifactType === "test-case"
      ? selectedArtifactId && selectedArtifact?.artifact_type === "test-case"
        ? (selectedArtifact.title ?? t("pages.testCase"))
        : selectedUnder
          ? (folderItems.find((x) => x.id === selectedUnder)?.title ?? t("pages.catalog"))
          : t("pages.catalog")
      : isTestsuitesExplorerLeaf
        ? selectedArtifactId && selectedArtifact?.artifact_type === artifactType
          ? (selectedArtifact.title ?? pageLabel)
          : selectedUnder
            ? (folderItems.find((x) => x.id === selectedUnder)?.title ?? pageLabel)
            : pageLabel
        : pageLabel;

  const defaultRunTitle =
    selectedArtifact?.title != null && selectedArtifact.title !== ""
      ? `${selectedArtifact.title} — ${dayjs().format("YYYY-MM-DD HH:mm")}`
      : dayjs().format("YYYY-MM-DD HH:mm");

  useEffect(() => {
    if (!showSuiteExecution || !selectedArtifactId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ".") {
        e.preventDefault();
        setSuiteCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSuiteExecution, selectedArtifactId]);

  const closeSuiteLinkModal = useCallback(() => {
    setSuiteLinkModalOpen(false);
    setSearchParams(
      (prev) => {
        if (!prev.get("addTests")) return prev;
        const next = new URLSearchParams(prev);
        next.delete("addTests");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const confirmStartRun = useCallback(
    async ({ title, description, environment }: { title: string; description: string; environment?: string }) => {
      if (!selectedArtifact?.parent_id) return;
      await startSuiteRun.mutateAsync({
        suiteId: selectedArtifact.id,
        suiteParentId: selectedArtifact.parent_id,
        title,
        description,
        environment,
      });
      setRunDialogOpen(false);
    },
    [selectedArtifact, startSuiteRun],
  );

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  const openCreateModal = (forcedUnderId?: string) => {
    const resolvedParent = forcedUnderId ?? selectedUnder;
    if (forcedUnderId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("under", forcedUnderId);
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }
    const initialSteps: TestPlanEntry[] = [];
    modalApi.openQualityArtifact(
      {
        mode: "create",
        artifactType,
        initialSteps,
        enableStepsEditor,
        testCasePickerContext:
          enableStepsEditor && orgSlug && project?.id
            ? { orgSlug, projectId: project.id, excludeArtifactId: undefined }
            : undefined,
        isPending: createArtifact.isPending,
        onSubmit: async ({ title, description, steps, testParams }) => {
          if (!project?.id || !orgSlug) return;
          let parentId = resolvedParent;
          if (artifactType === folderArtifactType && !parentId) parentId = rootQualityId;
          if (!parentId && artifactType !== folderArtifactType) {
            throw new Error(
              isCampaignTree ? t("errors.selectCollectionBeforeCreate") : t("errors.selectFolderBeforeCreate"),
            );
          }
          const payload: {
            artifact_type: string;
            title: string;
            description?: string;
            parent_id?: string;
            custom_fields?: Record<string, unknown>;
          } = {
            artifact_type: artifactType,
            title,
            description,
            parent_id: parentId ?? undefined,
          };
          if (enableStepsEditor) {
            const cf: Record<string, unknown> = {};
            if (steps && steps.length > 0) {
              cf.test_steps_json = serializeTestPlan(normalizeTestPlan(steps));
            }
            if (testParams?.defs?.length) {
              cf.test_params_json = serializeTestParams(normalizeTestParams(testParams));
            }
            if (Object.keys(cf).length > 0) payload.custom_fields = cf;
          }
          const created = await createArtifact.mutateAsync(payload);
          modalApi.closeModal();
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set("artifact", created.id);
              return next;
            },
            { replace: true },
          );
        },
      },
      { title: t("modals.createTitle") },
    );
  };

  const openCreateFolderModal = (forcedParentId?: string) => {
    modalApi.openQualityArtifact(
      {
        mode: "create",
        artifactType: folderArtifactType,
        enableStepsEditor: false,
        isPending: createArtifact.isPending,
        onSubmit: async ({ title, description }) => {
          if (!project?.id || !orgSlug) return;
          const parentId = forcedParentId ?? selectedUnder ?? rootQualityId;
          if (!parentId) return;
          const created = await createArtifact.mutateAsync({
            artifact_type: folderArtifactType,
            title,
            description,
            parent_id: parentId,
          });
          modalApi.closeModal();
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set("under", created.id);
              next.delete("artifact");
              return next;
            },
            { replace: true },
          );
        },
      },
      { title: tmFolder("createFolderTitle") },
    );
  };

  const openRenameFolderModal = (folderId: string) => {
    const folder = folderItems.find((a) => a.id === folderId && a.artifact_type === folderArtifactType);
    if (!folder || !orgSlug || !project?.id) return;
    modalApi.openQualityArtifact(
      {
        mode: "edit",
        artifactType: folderArtifactType,
        initialTitle: folder.title ?? "",
        initialDescription: folder.description ?? "",
        enableStepsEditor: false,
        isPending: false,
        onSubmit: async ({ title, description }) => {
          await apiClient.patch(`/orgs/${orgSlug}/projects/${project.id}/artifacts/${folderId}`, {
            title,
            description,
          });
          await queryClient.invalidateQueries({
            queryKey: ["orgs", orgSlug, "projects", project.id, "artifacts"],
          });
          modalApi.closeModal();
        },
      },
      { title: tmFolder("renameFolderTitle") },
    );
  };

  const openDeleteFolderModal = (folderId: string) => {
    const folder = folderItems.find((a) => a.id === folderId && a.artifact_type === folderArtifactType);
    if (!folder || !orgSlug || !project?.id) return;
    modalApi.openDeleteArtifact(
      {
        artifact: {
          id: folder.id,
          title: folder.title,
          artifact_key: folder.artifact_key,
        },
        onConfirm: async () => {
          await apiClient.delete(`/orgs/${orgSlug}/projects/${project.id}/artifacts/${folderId}`);
          await queryClient.invalidateQueries({
            queryKey: ["orgs", orgSlug, "projects", project.id, "artifacts"],
          });
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (next.get("under") === folderId) next.delete("under");
            if (next.get("artifact")) next.delete("artifact");
            return next;
          });
        },
      },
      { title: tmFolder("deleteFolderTitle") },
    );
  };

  const openEditModal = (artifact: Artifact) => {
    const parsed = enableStepsEditor
      ? parseTestPlan((artifact.custom_fields as Record<string, unknown> | undefined)?.test_steps_json)
      : [];
    const initialParams = parseTestParams(
      (artifact.custom_fields as Record<string, unknown> | undefined)?.test_params_json,
    );
    modalApi.openQualityArtifact(
      {
        mode: "edit",
        artifactType,
        initialTitle: artifact.title ?? "",
        initialDescription: artifact.description ?? "",
        initialSteps: parsed,
        initialTestParams: initialParams,
        enableStepsEditor,
        testCasePickerContext:
          enableStepsEditor && orgSlug && project?.id
            ? { orgSlug, projectId: project.id, excludeArtifactId: artifact.id }
            : undefined,
        onNavigateToTestCase: (testCaseId) => {
          modalApi.closeModal();
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set("artifact", testCaseId);
              const cached = queryClient.getQueryData<Artifact>([
                "orgs",
                orgSlug,
                "projects",
                project?.id,
                "artifacts",
                testCaseId,
              ]);
              const pid = cached?.parent_id;
              if (pid && isUuid(pid)) next.set("under", pid);
              return next;
            },
            { replace: true },
          );
        },
        isPending: patchArtifactMutation.isPending,
        onSubmit: async ({ title, description, steps, testParams }) => {
          if (!artifact.id || !orgSlug || !project?.id) return;
          const body: Record<string, unknown> = { title, description };
          if (enableStepsEditor) {
            const prev = (artifact.custom_fields ?? {}) as Record<string, unknown>;
            const nextCf: Record<string, unknown> = {
              ...prev,
              test_steps_json: serializeTestPlan(normalizeTestPlan(steps ?? [])),
            };
            if (testParams?.defs?.length) {
              nextCf.test_params_json = serializeTestParams(normalizeTestParams(testParams));
            } else {
              delete nextCf.test_params_json;
            }
            body.custom_fields = nextCf;
          }
          await patchArtifactMutation.mutateAsync({ artifactId: artifact.id, body });
          modalApi.closeModal();
        },
      },
      { title: t("modals.editTitle") },
    );
  };

  const openEditLeafFromTree = (id: string) => {
    const a = folderItems.find((x) => x.id === id);
    if (a) openEditModal(a);
  };

  const openMoveLeafModal = (id: string) => {
    const a = folderItems.find((x) => x.id === id);
    setMoveArtifactId(id);
    setMoveTargetFolderId(typeof a?.parent_id === "string" ? a.parent_id : "");
  };

  const openDeleteLeafFromTree = (id: string) => {
    const a = folderItems.find((x) => x.id === id && x.artifact_type === artifactType);
    if (!a) return;
    modalApi.openDeleteArtifact(
      {
        artifact: {
          id: a.id,
          title: a.title,
          artifact_key: a.artifact_key,
        },
        onConfirm: async () => {
          await deleteArtifact.mutateAsync(id);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (next.get("artifact") === id) next.delete("artifact");
            return next;
          });
        },
      },
      { title: t("modals.deleteTitle") },
    );
  };

  const confirmMoveLeaf = async () => {
    if (!moveArtifactId || !moveTargetFolderId || !orgSlug || !project?.id) return;
    await patchArtifactMutation.mutateAsync({
      artifactId: moveArtifactId,
      body: { parent_id: moveTargetFolderId },
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("under", moveTargetFolderId);
        next.set("artifact", moveArtifactId);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
    setMoveArtifactId(null);
    setMoveTargetFolderId("");
  };

  const onDeleteSelected = async () => {
    if (!selectedArtifact) return;
    modalApi.openDeleteArtifact(
      {
        artifact: {
          id: selectedArtifact.id,
          title: selectedArtifact.title,
          artifact_key: selectedArtifact.artifact_key,
        },
        onConfirm: async () => {
          await deleteArtifact.mutateAsync(selectedArtifact.id);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("artifact");
            return next;
          });
        },
      },
      { title: t("modals.deleteTitle") },
    );
  };

  const addLink = async () => {
    if (!targetArtifactId || !linkConfig) return;
    await createLink.mutateAsync({
      relationship_type: linkConfig.linkType,
      target_artifact_id: targetArtifactId,
    });
    setTargetArtifactId("");
  };

  const suiteIncludesTestCard =
    linkConfig && selectedArtifact && artifactType === "test-suite" && linkConfig.linkType === "suite_includes_test" ? (
      <Card className="w-full rounded-xl border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{linkConfig.title}</CardTitle>
          <CardDescription>Link type: {linkConfig.linkType}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setSuiteLinkModalOpen(true)}
              data-testid={showSuiteExecution ? "quality-suite-add-tests" : "quality-link-manage-modal"}
              disabled={!canUpdateSelectedArtifact}
              title={!canUpdateSelectedArtifact ? "You do not have permission to update links." : undefined}
            >
              Manage links
            </Button>
            {showSuiteExecution ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRunDialogOpen(true)}
                disabled={orderedSuiteLinks.length === 0 || !canUpdateSelectedArtifact}
                title={
                  orderedSuiteLinks.length === 0 ? t("campaignExecution.emptySuiteHint") : undefined
                }
              >
                <PlayCircle className="mr-2 size-4" />
                {t("campaignExecution.runSuite")}
              </Button>
            ) : null}
          </div>
          {linkedTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked items yet.</p>
          ) : orgSlug && project?.id ? (
            <SuiteIncludedTestsReorderList
              orgSlug={orgSlug}
              projectId={project.id}
              suiteId={selectedArtifact.id}
              linkType={linkConfig.linkType}
              links={linksQuery.data ?? []}
              targetsById={suiteLinkedTargetsById}
              canUpdate={canUpdateSelectedArtifact}
            />
          ) : (
            <div className="space-y-2" data-testid="suite-includes-readonly-list">
              <p className="text-xs text-muted-foreground">{t("campaignExecution.suitePlanReadonlyContext")}</p>
              {orderedSuiteLinks.map((link, idx) => {
                const row = suiteLinkedTargetsById.get(link.target_artifact_id);
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{idx + 1}</span>
                    <span className="min-w-0 flex-1 font-medium">{row?.title ?? link.target_artifact_id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    ) : null;

  return (
    <>
    <div
      className={`mx-auto flex min-h-0 flex-col gap-4 px-4 pb-6 pt-6 lg:flex-row ${
        showSuiteExecution ? "lg:items-stretch lg:min-h-[min(70vh,720px)]" : "lg:items-start"
      } ${isCampaignTree ? "w-full max-w-[min(1600px,100%)]" : "max-w-6xl"}`}
    >
      <aside className="w-full shrink-0 lg:w-64">
        <QualityFolderTreeNav
          orgSlug={orgSlug}
          projectId={project?.id}
          manifestBundle={manifest?.manifest_bundle}
          onCreateFolderUnder={allowFolderCreate ? (parentId) => openCreateFolderModal(parentId) : undefined}
          onRenameFolder={allowFolderCreate ? openRenameFolderModal : undefined}
          onDeleteFolder={allowFolderCreate ? openDeleteFolderModal : undefined}
          leafArtifactType={showExplorerLeaves ? artifactType : undefined}
          treeId={treeId}
          rootArtifactType={rootArtifactType}
          folderArtifactType={folderArtifactType}
          explorerLabels={isCampaignTree ? "campaign" : "quality"}
          newLeafLabel={newLeafMenuLabel}
          selectedArtifactId={selectedArtifactId}
          onNewLeafInFolder={showExplorerLeaves ? (fid) => openCreateModal(fid) : undefined}
          onSelectLeaf={(leafId, parentFolderId) => {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set("under", parentFolderId);
                next.set("artifact", leafId);
                next.delete("page");
                return next;
              },
              { replace: true },
            );
          }}
          onEditLeaf={showExplorerLeaves ? openEditLeafFromTree : undefined}
          onMoveLeaf={showExplorerLeaves ? openMoveLeafModal : undefined}
          onDeleteLeaf={showExplorerLeaves ? openDeleteLeafFromTree : undefined}
        />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 space-y-4">
        <ProjectBreadcrumbs
          currentPageLabel={breadcrumbCurrentLabel}
          projectName={project?.name}
          trailBeforeCurrent={catalogBreadcrumbTrail}
          showBackToProject={false}
        />
        {!isTreeDetail && !isCampaignTree ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{pageLabel}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasTargetTree ? (
                <p className="text-sm text-muted-foreground">
                  {t("workspace.noQualityTree")} <code>tree_id: {treeId}</code>.
                </p>
              ) : null}
              {!selectedUnder && artifactType !== folderArtifactType ? (
                <p className="text-sm text-muted-foreground">{tws("selectFolderFirst")}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => openCreateModal()}
                  data-testid="quality-create-button"
                  disabled={createArtifact.isPending || (!selectedUnder && artifactType !== folderArtifactType)}
                >
                  {createCta}
                </Button>
                {showTestCaseIoActions ? (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" disabled={ioBusy}>
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => void handleWorkspaceExport("csv")}>
                          Test cases CSV bundle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleWorkspaceExport("xlsx")}>
                          Test cases XLSX
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" disabled={ioBusy}>
                          Test case templates
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => void handleTemplateDownload("csv")}>
                          CSV bundle template
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleTemplateDownload("xlsx")}>
                          XLSX template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button type="button" variant="outline" onClick={() => setImportDialogOpen(true)} disabled={ioBusy}>
                      Import test cases
                    </Button>
                  </>
                ) : null}
                {allowFolderCreate ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openCreateFolderModal()}
                    data-testid="quality-create-folder-button"
                    disabled={createArtifact.isPending || !rootQualityId}
                  >
                    {tws("createFolder")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : !isTreeDetail && isCampaignTree && !hasTargetTree ? (
          <p className="text-sm text-muted-foreground">
            {t("workspace.noQualityTree")} <code>tree_id: {treeId}</code>.
          </p>
        ) : !isTreeDetail && isCampaignTree && hasTargetTree && !selectedUnder && artifactType !== folderArtifactType ? (
          <p className="text-sm text-muted-foreground">{tws("selectFolderFirst")}</p>
        ) : null}
        {isTreeDetail && !hasTargetTree ? (
          <p className="text-sm text-muted-foreground">
            {t("workspace.noQualityTree")} <code>tree_id: {treeId}</code>.
          </p>
        ) : null}

        {isTreeDetail ? (
          suiteLinkOnlyCentered &&
          selectedArtifactId &&
          selectedArtifact?.artifact_type === artifactType &&
          suiteIncludesTestCard ? (
            <div className="w-full max-w-3xl pb-2 xl:max-w-4xl" data-testid="quality-tree-detail-panel">
              {suiteIncludesTestCard}
              {showSuiteExecution && selectedArtifact && orgSlug && project?.id && projectSlug ? (
                <SuiteRecentRunsCard
                  orgSlug={orgSlug}
                  projectId={project.id}
                  projectSlug={projectSlug}
                  suiteId={selectedArtifact.id}
                  links={linksQuery.data}
                  linksLoading={linksQuery.isPending}
                />
              ) : null}
            </div>
          ) : (
          <Card data-testid="quality-tree-detail-panel">
            <CardHeader className="pb-2">
              <div className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <CardTitle className="text-base">
                    {selectedArtifactId
                      ? artifactType === "test-suite" && isCampaignTree
                        ? t("campaignWorkspace.suiteDetailTitle")
                        : artifactType === "test-run" && isCampaignTree
                          ? t("campaignWorkspace.runDetailTitle")
                          : artifactType === "test-campaign" && isCampaignTree
                            ? t("campaignWorkspace.executionCampaignDetailTitle")
                            : t("workspace.testCaseDetailTitle")
                      : !selectedUnder
                        ? isCampaignTree
                          ? pageLabel
                          : t("workspace.catalogRootDetailTitle")
                        : tws("groupDetailTitle")}
                  </CardTitle>
                  <CardDescription>
                    {selectedArtifactId
                      ? artifactType === "test-suite" && isCampaignTree
                        ? t("campaignWorkspace.suiteDetailDescription")
                        : artifactType === "test-run" && isCampaignTree
                          ? t("campaignWorkspace.runDetailDescription")
                          : artifactType === "test-campaign" && isCampaignTree
                            ? t("campaignWorkspace.executionCampaignDetailDescription")
                            : t("workspace.selectedItem")
                      : !selectedUnder
                        ? isCampaignTree
                          ? t("campaignWorkspace.campaignRootDetailHint")
                          : t("workspace.catalogRootDetailHint")
                        : tws("groupDetailDescription")}
                  </CardDescription>
                </div>
                {selectedArtifactId &&
                selectedArtifact &&
                selectedArtifact.artifact_type === artifactType &&
                !selectedArtifactQuery.isPending ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={t("common.edit")}
                      title={t("common.edit")}
                      onClick={() => openEditModal(selectedArtifact)}
                      data-testid="quality-edit-button"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      onClick={onDeleteSelected}
                      data-testid="quality-delete-button"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : selectedUnder &&
                  !selectedArtifactId &&
                  selectedScopeRow &&
                  selectedScopeRow.artifact_type === folderArtifactType &&
                  allowFolderCreate ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={t("common.edit")}
                      title={t("common.edit")}
                      onClick={() => openRenameFolderModal(selectedUnder)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      onClick={() => openDeleteFolderModal(selectedUnder)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {selectedArtifactId ? (
                selectedArtifactQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">{t("tree.loading")}</p>
                ) : !selectedArtifact ? (
                  <p className="text-sm text-muted-foreground">{t("workspace.noItemSelected")}</p>
                ) : selectedArtifact.artifact_type !== artifactType ? (
                  <p className="text-sm text-muted-foreground">{t("workspace.selectItemToEdit")}</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{selectedArtifact.title}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedArtifact.description || "—"}
                    </p>
                    {artifactType === "test-case" && selectedArtifact.artifact_type === "test-case" ? (
                      <QualityTestCaseDetailPanels
                        artifact={selectedArtifact}
                        orgSlug={orgSlug}
                        projectId={project?.id}
                        projectSlug={projectSlug}
                        enableStepsEditor={enableStepsEditor}
                      />
                    ) : null}
                  </div>
                )
              ) : !selectedUnder ? (
                <p className="text-sm text-muted-foreground">
                  {isCampaignTree
                    ? t("campaignWorkspace.campaignRootDetailHint")
                    : t("workspace.catalogRootDetailHint")}
                </p>
              ) : !selectedScopeRow ? (
                <p className="text-sm text-muted-foreground">{tws("groupNotFound")}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{selectedScopeRow.title ?? tws("unknownGroupTitle")}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {selectedScopeRow.description || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isCampaignTree
                      ? tws(testsuitesCollectionSummaryKey, {
                          groups: directChildStats.groups,
                          cases: directChildStats.cases,
                        })
                      : t("workspace.groupDirectChildrenSummary", {
                          groups: directChildStats.groups,
                          cases: directChildStats.cases,
                        })}
                  </p>
                  {isCampaignTree && showExplorerLeaves ? (
                    <>
                      <p className="text-sm text-muted-foreground">{tws(testsuitesCollectionNextStepsKey)}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          onClick={() => openCreateModal(selectedUnder)}
                          disabled={createArtifact.isPending}
                          data-testid="quality-testsuites-collection-create-cta"
                        >
                          {createCta}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
          )
        ) : suiteLinkOnlyCentered &&
          selectedArtifactId &&
          selectedArtifact?.artifact_type === artifactType &&
          suiteIncludesTestCard ? (
          <div className="w-full max-w-3xl pb-2 xl:max-w-4xl" data-testid="quality-suite-detail-panel">
            {suiteIncludesTestCard}
            {showSuiteExecution && selectedArtifact && orgSlug && project?.id && projectSlug ? (
              <SuiteRecentRunsCard
                orgSlug={orgSlug}
                projectId={project.id}
                projectSlug={projectSlug}
                suiteId={selectedArtifact.id}
                links={linksQuery.data}
                linksLoading={linksQuery.isPending}
              />
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Items</CardTitle>
                <CardDescription>
                  {selectedUnder ? tws("selectedFolderChildren") : tws("selectFolderToList")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {artifactType === "test-case" ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      Scope: {selectedUnder ? tws("scopeSelectedGroup") : tws("scopeNoGroup")}
                    </Badge>
                    <Badge variant="outline">
                      Mode: {workspaceIncludeSubfolders ? "Include subfolders" : "Direct children"}
                    </Badge>
                    <label
                      htmlFor={workspaceSubfoldersSwitchId}
                      className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Switch
                        id={workspaceSubfoldersSwitchId}
                        checked={workspaceIncludeSubfolders}
                        onCheckedChange={setWorkspaceIncludeSubfolders}
                        disabled={!selectedUnder}
                      />
                      Include subfolders
                    </label>
                  </div>
                ) : null}
                {workspaceItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {artifactType === "test-case" && workspaceIncludeSubfolders
                      ? t("workspace.emptyCatalogScope")
                      : emptyLabel}
                  </p>
                ) : (
                  workspaceItems.map((item: Artifact) => {
                    const active = selectedArtifactId === item.id;
                    const isFolderRow = item.artifact_type === folderArtifactType;
                    return (
                      <button
                        key={item.id}
                        data-testid={`quality-item-row-${item.id}`}
                        type="button"
                        onClick={() => {
                          if (isFolderRow) {
                            setSearchParams((prev) => {
                              const next = new URLSearchParams(prev);
                              next.set("under", item.id);
                              next.delete("artifact");
                              return next;
                            });
                            return;
                          }
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set("artifact", item.id);
                            return next;
                          });
                        }}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 font-medium">{item.title}</div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!isFolderRow && item.artifact_type === "test-case" ? (
                              <TestLastStatusBadge item={lastExecById.get(item.id)} />
                            ) : null}
                            {isFolderRow ? <Badge variant="secondary">{tws("groupBadge")}</Badge> : null}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isFolderRow ? item.artifact_type : item.artifact_key ?? item.artifact_type}
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-row items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <CardTitle className="text-base">Details</CardTitle>
                    <CardDescription>
                      {selectedArtifact ? t("workspace.selectedItem") : t("workspace.selectItemToEdit")}
                    </CardDescription>
                  </div>
                  {selectedArtifact ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                        onClick={() => openEditModal(selectedArtifact)}
                        data-testid="quality-edit-button"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                        onClick={onDeleteSelected}
                        data-testid="quality-delete-button"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedArtifact ? (
                  <p className="text-sm text-muted-foreground">{t("workspace.noItemSelected")}</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{selectedArtifact.title}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedArtifact.description || "—"}
                    </p>
                    {artifactType === "test-case" && selectedArtifact.artifact_type === "test-case" ? (
                      <QualityTestCaseDetailPanels
                        artifact={selectedArtifact}
                        orgSlug={orgSlug}
                        projectId={project?.id}
                        projectSlug={projectSlug}
                        enableStepsEditor={enableStepsEditor}
                      />
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {linkConfig && selectedArtifact && !suiteLinkOnlyCentered ? (
          artifactType === "test-suite" && linkConfig.linkType === "suite_includes_test" ? (
            suiteIncludesTestCard
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{linkConfig.title}</CardTitle>
                <CardDescription>Link type: {linkConfig.linkType}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <select
                    aria-label={`${linkConfig.targetType} selection`}
                    data-testid="quality-link-target-select"
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={targetArtifactId}
                    onChange={(e) => setTargetArtifactId(e.target.value)}
                  >
                    <option value="">Select {linkConfig.targetType}</option>
                    {availableTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.title}
                      </option>
                    ))}
                  </select>
                  <Button type="button" disabled={!targetArtifactId || createLink.isPending} onClick={addLink} data-testid="quality-link-add">
                    Add link
                  </Button>
                </div>
                {linkedTargets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No linked items yet.</p>
                ) : (
                  linkedTargets.map((target) => {
                    const link = selectedLinks.find((l) => l.target_artifact_id === target.id);
                    if (!link) return null;
                    return (
                      <div key={link.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>{target.title}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteLink.mutate(link.id)}>
                          Remove
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )
        ) : null}
        {project?.id && orgSlug && selectedArtifact && linkConfig && artifactType === "test-suite" && !showSuiteExecution ? (
          <SuiteTestLinkModal
            open={suiteLinkModalVisible}
            onClose={closeSuiteLinkModal}
            orgSlug={orgSlug}
            projectId={project.id}
            suiteArtifactId={selectedArtifact.id}
            linkType={linkConfig.linkType}
            manifestBundle={manifest?.manifest_bundle}
            presentation="dialog"
          />
        ) : null}

        {showSuiteExecution && selectedArtifact && orgSlug && project?.id ? (
          <>
            <StartSuiteRunDialog
              open={runDialogOpen}
              onClose={() => setRunDialogOpen(false)}
              suiteTitle={selectedArtifact.title ?? ""}
              defaultTitle={defaultRunTitle}
              isSubmitting={startSuiteRun.isPending}
              onConfirm={(values) => void confirmStartRun(values)}
            />
            <CampaignSuiteCommandDialog
              open={suiteCommandOpen}
              onClose={() => setSuiteCommandOpen(false)}
              onAddTests={() => setSuiteLinkModalOpen(true)}
              onRun={() => setRunDialogOpen(true)}
              runDisabled={orderedSuiteLinks.length === 0}
            />
          </>
        ) : null}

        {runExecute && selectedArtifactId && orgSlug && projectSlug ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              title={t("runsHub.executeInNewWindow")}
              onClick={() =>
                navigateToManualExecution(navigate, orgSlug, projectSlug, selectedArtifactId)
              }
            >
              <PlayCircle className="mr-2 size-4" />
              {t("runsHub.executeOrContinue")}
            </Button>
          </div>
        ) : null}

        {!isTreeDetail ? (
          <div className="pt-2">
            {orgSlug && projectSlug ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={qualityPath(orgSlug, projectSlug)}>Back to Quality</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        {isTestCaseWorkspace ? (
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent aria-describedby={undefined} className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import test cases</DialogTitle>
                <DialogDescription className="sr-only">
                  Upload a test case workbook or CSV bundle, choose the import mode, and review row-level results.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quality-testcase-import-mode">Mode</Label>
                    <Select value={importMode} onValueChange={(value) => setImportMode(value as ArtifactImportMode)}>
                      <SelectTrigger id="quality-testcase-import-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="upsert">Upsert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={importValidateOnly} onCheckedChange={(checked) => setImportValidateOnly(checked === true)} />
                      Validate only
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quality-testcase-import-file">File</Label>
                  <Input
                    id="quality-testcase-import-file"
                    type="file"
                    accept=".csv,.xlsx,.zip"
                    aria-label="Select test case import file"
                    onChange={(event) => {
                      setImportFile(event.target.files?.[0] ?? null);
                      setImportResult(null);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use the XLSX template for workbook import or the ZIP bundle for CSV-based test case import.
                  </p>
                </div>
                {importResult ? (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">
                      Summary: created {importResult.created_count}, updated {importResult.updated_count}, validated{" "}
                      {importResult.validated_count}, failed {importResult.failed_count}
                    </div>
                    <div className="max-h-56 space-y-1 overflow-auto text-xs">
                      {importResult.rows.slice(0, 30).map((row, idx) => (
                        <div key={`${row.sheet}-${row.row_number}-${idx}`} className="rounded border px-2 py-1">
                          <span className="font-medium">
                            {row.sheet} row {row.row_number}
                          </span>{" "}
                          <span className="uppercase text-muted-foreground">{row.status}</span>
                          {row.artifact_key ? <span> {row.artifact_key}</span> : null}
                          {row.message ? <div className="text-muted-foreground">{row.message}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => void handleImportSubmit()} disabled={!importFile || ioBusy}>
                  {importValidateOnly ? "Validate file" : "Import file"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {project?.id &&
      orgSlug &&
      selectedArtifact &&
      linkConfig &&
      artifactType === "test-suite" &&
      showSuiteExecution &&
      suiteLinkModalVisible ? (
        <div
          className="fixed inset-0 z-40 flex flex-row lg:static lg:z-auto lg:inset-auto lg:contents"
          data-testid="quality-suite-catalog-dock-layer"
        >
          <button
            type="button"
            className="min-h-0 flex-1 cursor-default border-0 bg-black/40 lg:hidden"
            aria-label={t("common.close")}
            onClick={closeSuiteLinkModal}
          />
          <SuiteTestLinkModal
            presentation="dock"
            open
            onClose={closeSuiteLinkModal}
            orgSlug={orgSlug}
            projectId={project.id}
            suiteArtifactId={selectedArtifact.id}
            linkType={linkConfig.linkType}
            manifestBundle={manifest?.manifest_bundle}
          />
        </div>
      ) : null}
    </div>

    <Dialog
      open={moveArtifactId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setMoveArtifactId(null);
          setMoveTargetFolderId("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tmMove("moveToFolderTitle")}</DialogTitle>
          <DialogDescription>{tmMove("moveToFolderDescription")}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select
            value={moveTargetFolderId || undefined}
            onValueChange={setMoveTargetFolderId}
          >
            <SelectTrigger aria-label={tmMove("moveToFolderPlaceholder")}>
              <SelectValue placeholder={tmMove("moveToFolderPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {qualityFolderOptions.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.title || f.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMoveArtifactId(null);
              setMoveTargetFolderId("");
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={
              !moveArtifactId ||
              !moveTargetFolderId ||
              patchArtifactMutation.isPending ||
              qualityFolderOptions.length === 0
            }
            onClick={() => void confirmMoveLeaf()}
          >
            {t("modals.moveToFolderSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
