import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import {
  useArtifact,
  useArtifacts,
  useCreateArtifact,
  useUpdateArtifact,
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
  Input,
} from "../../../shared/components/ui";
import { QualityFolderTreeNav } from "./QualityFolderTreeNav";
import { qualityPath } from "../../../shared/utils/appPaths";
import { TestStepsEditor } from "./TestStepsEditor";
import type { TestStep } from "../types";

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
}

function isUuid(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseTestSteps(raw: unknown): TestStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: TestStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : `step-${steps.length + 1}`;
    steps.push({
      id,
      stepNumber: typeof obj.stepNumber === "number" ? obj.stepNumber : steps.length + 1,
      action: typeof obj.action === "string" ? obj.action : "",
      expectedResult: typeof obj.expectedResult === "string" ? obj.expectedResult : "",
      status: "not-executed",
    });
  }
  return steps;
}

export default function QualityArtifactWorkspace({
  artifactType,
  pageLabel,
  description,
  createCta,
  emptyLabel,
  linkConfig,
  runExecute = false,
  enableStepsEditor = false,
}: QualityArtifactWorkspaceProps) {
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
  const selectedArtifactQuery = useArtifact(orgSlug, project?.id, selectedArtifactId ?? undefined);
  const updateArtifact = useUpdateArtifact(orgSlug, project?.id, selectedArtifactId ?? undefined);
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

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [targetArtifactId, setTargetArtifactId] = useState("");
  const selectedArtifact = selectedArtifactQuery.data;
  const listItems = listQuery.data?.items ?? [];

  useEffect(() => {
    if (!selectedArtifact) {
      setEditTitle("");
      setEditDescription("");
      setSteps([]);
      return;
    }
    setEditTitle(selectedArtifact.title ?? "");
    setEditDescription(selectedArtifact.description ?? "");
    if (enableStepsEditor) {
      const rawSteps = (selectedArtifact.custom_fields as Record<string, unknown> | undefined)?.test_steps_json;
      setSteps(parseTestSteps(rawSteps));
    } else {
      setSteps([]);
    }
  }, [enableStepsEditor, selectedArtifact]);

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

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!project?.id || !orgSlug) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    let parentId = selectedUnder;
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
      title: trimmed,
      description: newDescription.trim(),
      parent_id: parentId ?? undefined,
    };
    if (enableStepsEditor && steps.length > 0) payload.custom_fields = { test_steps_json: steps };
    const created = await createArtifact.mutateAsync(payload);
    setNewTitle("");
    setNewDescription("");
    setSteps([]);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("artifact", created.id);
        return next;
      },
      { replace: true },
    );
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedArtifactId) return;
    const customFields =
      enableStepsEditor && selectedArtifact
        ? {
            ...((selectedArtifact.custom_fields ?? {}) as Record<string, unknown>),
            test_steps_json: steps,
          }
        : undefined;
    await updateArtifact.mutateAsync({
      title: editTitle.trim(),
      description: editDescription,
      custom_fields: customFields,
    });
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
    <div className="mx-auto flex max-w-6xl min-h-0 flex-col gap-4 px-4 pb-6 pt-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:w-64">
        <QualityFolderTreeNav orgSlug={orgSlug} projectId={project?.id} manifestBundle={manifest?.manifest_bundle} />
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
                Quality tree manifestte tanımlı değil. <code>tree_id: quality</code> eklenmeli.
              </p>
            ) : null}
            {!selectedUnder && artifactType !== "quality-folder" ? (
              <p className="text-sm text-muted-foreground">Önce soldan bir klasor secin.</p>
            ) : null}
            <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={onCreate}>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`${createCta} title`}
                disabled={createArtifact.isPending || (!selectedUnder && artifactType !== "quality-folder")}
              />
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                disabled={createArtifact.isPending || (!selectedUnder && artifactType !== "quality-folder")}
              />
              <Button
                type="submit"
                disabled={createArtifact.isPending || !newTitle.trim() || (!selectedUnder && artifactType !== "quality-folder")}
              >
                {createCta}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Items</CardTitle>
              <CardDescription>{selectedUnder ? "Selected folder children" : "Select a folder to list items"}</CardDescription>
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
              <CardDescription>{selectedArtifact ? "Edit selected item" : "Select an item to edit"}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedArtifact ? (
                <p className="text-sm text-muted-foreground">No item selected.</p>
              ) : (
                <form className="space-y-3" onSubmit={onSave}>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <textarea
                    aria-label="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  {enableStepsEditor ? <TestStepsEditor steps={steps} onChange={setSteps} /> : null}
                  <Button type="submit" disabled={updateArtifact.isPending || !editTitle.trim()}>
                    Save
                  </Button>
                </form>
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
                <Button type="button" disabled={!targetArtifactId || createLink.isPending} onClick={addLink}>
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
  );
}

