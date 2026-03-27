import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, PlayCircle, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import {
  useArtifact,
  useArtifacts,
  useCreateArtifact,
  useDeleteArtifact,
  type Artifact,
} from "../../../shared/api/artifactApi";
import {
  useArtifactLinks,
  useCreateArtifactLink,
  useDeleteArtifactLink,
} from "../../../shared/api/artifactLinkApi";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { qualityPath, qualityCatalogPath } from "../../../shared/utils/appPaths";
import type { BreadcrumbSegment } from "../../../shared/components/Layout";
import type { TestPlanEntry } from "../types";
import { parseTestPlan, normalizeTestPlan, serializeTestPlan } from "../lib/testPlan";
import { parseTestParams, serializeTestParams, normalizeTestParams } from "../lib/testParams";
import { modalApi } from "../../../shared/modal/modalApi";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../../shared/api/client";

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
  const { orgSlug, projectSlug, project, projectsLoading } = useArtifactsPageProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const selectedUnder = isUuid(searchParams.get("under")) ? searchParams.get("under") : null;
  const selectedArtifactId = isUuid(searchParams.get("artifact")) ? searchParams.get("artifact") : null;
  const treeRoots = useMemo(
    () => getDeclaredTreeRootsFromManifestBundle(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const hasTargetTree = treeRoots.some((t) => t.tree_id === treeId);
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
  const selectedArtifactQuery = useArtifact(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const linksQuery = useArtifactLinks(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const createLink = useCreateArtifactLink(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const deleteLink = useDeleteArtifactLink(orgSlug, project?.id, selectedArtifactId ?? undefined);

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
    if (!linkConfig) return [];
    return (linksQuery.data ?? []).filter((l) => l.link_type === linkConfig.linkType);
  }, [linkConfig, linksQuery.data]);

  const linkedTargetIds = useMemo(() => new Set(selectedLinks.map((l) => l.to_artifact_id)), [selectedLinks]);
  const linkedTargets = linkTargets.filter((a) => linkedTargetIds.has(a.id));
  const availableTargets = linkTargets.filter((a) => !linkedTargetIds.has(a.id));

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

  const breadcrumbCurrentLabel =
    artifactType !== "test-case"
      ? pageLabel
      : selectedArtifactId && selectedArtifact?.artifact_type === "test-case"
        ? (selectedArtifact.title ?? t("pages.testCase"))
        : selectedUnder
          ? (folderItems.find((x) => x.id === selectedUnder)?.title ?? t("pages.catalog"))
          : t("pages.catalog");

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
      link_type: linkConfig.linkType,
      to_artifact_id: targetArtifactId,
    });
    setTargetArtifactId("");
  };

  return (
    <>
    <div className="mx-auto flex max-w-6xl min-h-0 flex-col gap-4 px-4 pb-6 pt-6 lg:flex-row lg:items-start">
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

      <div className="min-w-0 flex-1 space-y-4">
        <ProjectBreadcrumbs
          currentPageLabel={breadcrumbCurrentLabel}
          projectName={project?.name}
          trailBeforeCurrent={catalogBreadcrumbTrail}
          showBackToProject={!isTreeDetail}
        />
        {!isTreeDetail ? (
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
        ) : !hasTargetTree ? (
          <p className="text-sm text-muted-foreground">
            {t("workspace.noQualityTree")} <code>tree_id: {treeId}</code>.
          </p>
        ) : null}

        {isTreeDetail ? (
          <Card data-testid="quality-tree-detail-panel">
            <CardHeader className="pb-2">
              <div className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <CardTitle className="text-base">
                    {selectedArtifactId
                      ? t("workspace.testCaseDetailTitle")
                      : !selectedUnder
                        ? t("workspace.catalogRootDetailTitle")
                        : tws("groupDetailTitle")}
                  </CardTitle>
                  <CardDescription>
                    {selectedArtifactId
                      ? t("workspace.selectedItem")
                      : !selectedUnder
                        ? t("workspace.catalogRootDetailHint")
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
                        links={linksQuery.data}
                        linksLoading={linksQuery.isPending}
                      />
                    ) : null}
                  </div>
                )
              ) : !selectedUnder ? (
                <p className="text-sm text-muted-foreground">{t("workspace.catalogRootDetailHint")}</p>
              ) : !selectedScopeRow ? (
                <p className="text-sm text-muted-foreground">{tws("groupNotFound")}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{selectedScopeRow.title ?? tws("unknownGroupTitle")}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {selectedScopeRow.description || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tws("groupDirectChildrenSummary", {
                      groups: directChildStats.groups,
                      cases: directChildStats.cases,
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
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
                          <div className="font-medium">{item.title}</div>
                          {isFolderRow ? <Badge variant="secondary">{tws("groupBadge")}</Badge> : null}
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
                        links={linksQuery.data}
                        linksLoading={linksQuery.isPending}
                      />
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {linkConfig && selectedArtifact ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{linkConfig.title}</CardTitle>
              <CardDescription>Link type: {linkConfig.linkType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {artifactType === "test-suite" && linkConfig.linkType === "suite_includes_test" ? (
                <Button
                  type="button"
                  onClick={() => setSuiteLinkModalOpen(true)}
                  data-testid="quality-link-manage-modal"
                  disabled={!canUpdateSelectedArtifact}
                  title={!canUpdateSelectedArtifact ? "You do not have permission to update links." : undefined}
                >
                  Manage links
                </Button>
              ) : (
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
              )}
              {linkedTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked items yet.</p>
              ) : (
                linkedTargets.map((target) => {
                  const link = selectedLinks.find((l) => l.to_artifact_id === target.id);
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
        ) : null}
        {project?.id && orgSlug && selectedArtifact && linkConfig && artifactType === "test-suite" ? (
          <SuiteTestLinkModal
            open={suiteLinkModalOpen}
            onClose={() => setSuiteLinkModalOpen(false)}
            orgSlug={orgSlug}
            projectId={project.id}
            suiteArtifactId={selectedArtifact.id}
            linkType={linkConfig.linkType}
            manifestBundle={manifest?.manifest_bundle}
          />
        ) : null}

        {runExecute && selectedArtifactId && orgSlug && projectSlug ? (
          <div className="flex justify-end">
            <Button asChild>
              <Link to={`/${orgSlug}/${projectSlug}/quality/runs/${selectedArtifactId}/execute`}>
                <PlayCircle className="mr-2 size-4" />
                Execute run
              </Link>
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
      </div>
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

