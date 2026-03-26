import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlayCircle } from "lucide-react";
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
} from "../../../shared/components/ui";
import { QualityFolderTreeNav } from "./QualityFolderTreeNav";
import { qualityPath } from "../../../shared/utils/appPaths";
import type { TestStep } from "../types";
import { parseTestSteps, normalizeTestSteps } from "../lib/testSteps";
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
  pageLabel: string;
  description: string;
  createCta: string;
  emptyLabel: string;
  linkConfig?: LinkConfig;
  runExecute?: boolean;
  enableStepsEditor?: boolean;
  allowFolderCreate?: boolean;
}

function isUuid(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Quality artifacts that appear as leaves under `quality-folder` in the explorer (matches backend rules). */
const QUALITY_EXPLORER_LEAF_TYPES = new Set([
  "test-case",
  "test-suite",
  "test-run",
  "test-campaign",
]);

export default function QualityArtifactWorkspace({
  artifactType,
  pageLabel,
  description,
  createCta,
  emptyLabel,
  linkConfig,
  runExecute = false,
  enableStepsEditor = false,
  allowFolderCreate = false,
}: QualityArtifactWorkspaceProps) {
  const { t } = useTranslation("quality");
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
  const hasQualityTree = treeRoots.some((t) => t.tree_id === "quality");
  const showExplorerLeaves = QUALITY_EXPLORER_LEAF_TYPES.has(artifactType);

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
    "quality",
    true,
  );
  const rootQualityId = useMemo(
    () => (folderData?.items ?? []).find((a) => a.artifact_type === "root-quality")?.id ?? null,
    [folderData?.items],
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
    "quality",
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
    "quality",
    false,
  );

  const [targetArtifactId, setTargetArtifactId] = useState("");
  const [moveArtifactId, setMoveArtifactId] = useState<string | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState("");
  const selectedArtifact = selectedArtifactQuery.data;
  const listItems = listQuery.data?.items ?? [];
  const folderItems = folderData?.items ?? [];

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
        .filter((a) => a.artifact_type === "quality-folder")
        .slice()
        .sort((a, b) =>
          (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }),
        ),
    [folderData?.items],
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
    const initialSteps: TestStep[] = [];
    modalApi.openQualityArtifact(
      {
        mode: "create",
        artifactType,
        initialSteps,
        enableStepsEditor,
        isPending: createArtifact.isPending,
        onSubmit: async ({ title, description, steps }) => {
          if (!project?.id || !orgSlug) return;
          let parentId = resolvedParent;
          if (artifactType === "quality-folder" && !parentId) parentId = rootQualityId;
          if (!parentId && artifactType !== "quality-folder") return;
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
          if (enableStepsEditor && steps.length > 0) payload.custom_fields = { test_steps_json: normalizeTestSteps(steps) };
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
        artifactType: "quality-folder",
        enableStepsEditor: false,
        isPending: createArtifact.isPending,
        onSubmit: async ({ title, description }) => {
          if (!project?.id || !orgSlug) return;
          const parentId = forcedParentId ?? selectedUnder ?? rootQualityId;
          if (!parentId) return;
          const created = await createArtifact.mutateAsync({
            artifact_type: "quality-folder",
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
      { title: t("modals.createFolderTitle") },
    );
  };

  const openRenameFolderModal = (folderId: string) => {
    const folder = folderItems.find((a) => a.id === folderId && a.artifact_type === "quality-folder");
    if (!folder || !orgSlug || !project?.id) return;
    modalApi.openQualityArtifact(
      {
        mode: "edit",
        artifactType: "quality-folder",
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
      { title: t("modals.renameFolderTitle") },
    );
  };

  const openDeleteFolderModal = (folderId: string) => {
    const folder = folderItems.find((a) => a.id === folderId && a.artifact_type === "quality-folder");
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
      { title: t("modals.deleteFolderTitle") },
    );
  };

  const openEditModal = (artifact: Artifact) => {
    const parsed = enableStepsEditor
      ? parseTestSteps((artifact.custom_fields as Record<string, unknown> | undefined)?.test_steps_json)
      : [];
    modalApi.openQualityArtifact(
      {
        mode: "edit",
        artifactType,
        initialTitle: artifact.title ?? "",
        initialDescription: artifact.description ?? "",
        initialSteps: parsed,
        enableStepsEditor,
        isPending: patchArtifactMutation.isPending,
        onSubmit: async ({ title, description, steps }) => {
          if (!artifact.id || !orgSlug || !project?.id) return;
          const body: Record<string, unknown> = { title, description };
          if (enableStepsEditor) {
            body.custom_fields = {
              ...((artifact.custom_fields ?? {}) as Record<string, unknown>),
              test_steps_json: normalizeTestSteps(steps),
            };
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
        <ProjectBreadcrumbs currentPageLabel={pageLabel} projectName={project?.name} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{pageLabel}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasQualityTree ? (
              <p className="text-sm text-muted-foreground">
                {t("workspace.noQualityTree")} <code>tree_id: quality</code>.
              </p>
            ) : null}
            {!selectedUnder && artifactType !== "quality-folder" ? (
              <p className="text-sm text-muted-foreground">{t("workspace.selectFolderFirst")}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => openCreateModal()}
                data-testid="quality-create-button"
                disabled={createArtifact.isPending || (!selectedUnder && artifactType !== "quality-folder")}
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
                  {t("workspace.createFolder")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>{selectedUnder ? t("workspace.selectedFolderChildren") : t("workspace.selectFolderToList")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {listItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyLabel}</p>
              ) : (
                listItems.map((item: Artifact) => {
                  const active = selectedArtifactId === item.id;
                  return (
                    <button
                      key={item.id}
                      data-testid={`quality-item-row-${item.id}`}
                      type="button"
                      onClick={() =>
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.set("artifact", item.id);
                          return next;
                        })
                      }
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"}`}
                    >
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.artifact_key ?? item.artifact_type}</div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
              <CardDescription>{selectedArtifact ? t("workspace.selectedItem") : t("workspace.selectItemToEdit")}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedArtifact ? (
                <p className="text-sm text-muted-foreground">{t("workspace.noItemSelected")}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{selectedArtifact.title}</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selectedArtifact.description || "—"}</p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => openEditModal(selectedArtifact)} data-testid="quality-edit-button">
                      {t("common.edit")}
                    </Button>
                    <Button type="button" variant="destructive" onClick={onDeleteSelected} data-testid="quality-delete-button">
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {linkConfig && selectedArtifact ? (
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

        <div className="pt-2">
          {orgSlug && projectSlug ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={qualityPath(orgSlug, projectSlug)}>Back to Quality</Link>
            </Button>
          ) : null}
        </div>
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
          <DialogTitle>{t("modals.moveToFolderTitle")}</DialogTitle>
          <DialogDescription>{t("modals.moveToFolderDescription")}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select
            value={moveTargetFolderId || undefined}
            onValueChange={setMoveTargetFolderId}
          >
            <SelectTrigger aria-label={t("modals.moveToFolderPlaceholder")}>
              <SelectValue placeholder={t("modals.moveToFolderPlaceholder")} />
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

