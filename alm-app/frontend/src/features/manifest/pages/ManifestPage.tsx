import { useParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { Button, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Skeleton } from "../../../shared/components/ui";
import { LayoutGrid, GitBranch, Eye, Code, Save, Braces, Shield } from "lucide-react";
import yaml from "js-yaml";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import {
  useProjectManifest,
  useUpdateProjectManifest,
  type ManifestResponse,
} from "../../../shared/api/manifestApi";
import type { ProblemDetail } from "../../../shared/api/types";
import { buildPreviewSchemaFromManifest } from "../../../shared/lib/manifestPreviewSchema";
import { MetadataDrivenForm } from "../../../shared/components/forms/MetadataDrivenForm";
import { ManifestEditor } from "../../../shared/components/ManifestEditor";
import { useManifestStore } from "../../../shared/stores/manifestStore";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { WorkflowDesignerView } from "../components/WorkflowDesignerView";

/** Get 1-based line number from JSON.parse position (e.g. "Unexpected token at position 42"). */
function jsonErrorLine(source: string, error: unknown): number | undefined {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/\bposition\s+(\d+)/i);
  if (!match) return undefined;
  const position = Math.max(0, parseInt(match[1] ?? "0", 10));
  let line = 1;
  for (let i = 0; i < position && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

/** Backend errors are ProblemDetail { detail }; mutations receive that, not Error. */
function getApiErrorMessage(err: unknown, fallback = "Failed to save manifest."): string {
  if (err && typeof err === "object" && "detail" in err && typeof (err as { detail: unknown }).detail === "string") {
    return (err as { detail: string }).detail;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Sync defs ArtifactType.fields from artifact_types so types (e.g. date) match and save succeeds. */
function syncDefsFromArtifactTypes(bundle: Record<string, unknown>): void {
  const defs = bundle.defs as Array<Record<string, unknown>> | undefined;
  const artifactTypes = bundle.artifact_types as Array<Record<string, unknown>> | undefined;
  if (!defs?.length || !artifactTypes?.length) return;
  for (const at of artifactTypes) {
    const id = at.id as string | undefined;
    const flatFields = at.fields as Array<Record<string, unknown>> | undefined;
    if (!id || !flatFields?.length) continue;
    const def = defs.find((d) => d.kind === "ArtifactType" && d.id === id) as Record<string, unknown> | undefined;
    if (!def?.fields || !Array.isArray(def.fields)) continue;
    const defFields = def.fields as Array<Record<string, unknown>>;
    for (const ff of flatFields) {
      const fid = ff.id as string | undefined;
      if (!fid) continue;
      const existing = defFields.find((f) => (f.id as string) === fid);
      if (existing) {
        existing.type = ff.type ?? existing.type;
        if (ff.options != null) existing.options = ff.options;
      }
    }
  }
}

export default function ManifestPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);

  const {
    data: manifest,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectManifest(orgSlug, project?.id);
  const apiError = error as unknown as ProblemDetail | undefined;
  const is404 = isError && apiError?.status === 404;
  const is403 = isError && apiError?.status === 403;

  const activeTab = useManifestStore((s) => s.activeTab);
  const sourceValue = useManifestStore((s) => s.sourceValue);
  const sourceLanguage = useManifestStore((s) => s.sourceLanguage);
  const snackMessage = useManifestStore((s) => s.snackMessage);
  const snackOpen = useManifestStore((s) => s.snackOpen);
  const setActiveTab = useManifestStore((s) => s.setActiveTab);
  const setSourceValue = useManifestStore((s) => s.setSourceValue);
  const setSourceLanguage = useManifestStore((s) => s.setSourceLanguage);
  const showSnack = useManifestStore((s) => s.showSnack);
  const resetEditorFromBundle = useManifestStore((s) => s.resetEditorFromBundle);
  const clearSnack = useManifestStore((s) => s.clearSnack);

  const updateManifest = useUpdateProjectManifest(orgSlug, project?.id);
  const [editorErrorLine, setEditorErrorLine] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (manifest?.manifest_bundle != null) {
      resetEditorFromBundle(manifest.manifest_bundle);
    }
  }, [manifest?.manifest_bundle, resetEditorFromBundle]);

  const handleSourceLanguageChange = (value: "json" | "yaml") => {
    if (value === sourceLanguage) return;
    setEditorErrorLine(undefined);
    try {
      if (value === "yaml") {
        const parsed = JSON.parse(sourceValue) as object;
        setSourceValue(yaml.dump(parsed, { indent: 2, lineWidth: -1 }));
      } else {
        const parsed = yaml.load(sourceValue) as object;
        setSourceValue(JSON.stringify(parsed, null, 2));
      }
      setSourceLanguage(value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const yamlLine = e && typeof e === "object" && "mark" in e ? (e as { mark?: { line?: number } }).mark?.line : undefined;
      const oneBased = yamlLine != null ? yamlLine + 1 : (jsonErrorLine(sourceValue, e) ?? 1);
      setEditorErrorLine(oneBased);
      showSnack(yamlLine != null ? `Parse error at line ${oneBased}: ${msg}` : `Parse error: ${msg}`);
    }
  };

  const previewSchema = useMemo(
    () => (manifest?.manifest_bundle ? buildPreviewSchemaFromManifest(manifest.manifest_bundle) : null),
    [manifest?.manifest_bundle],
  );
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});

  const handleSourceChange = (value: string) => {
    setEditorErrorLine(undefined);
    setSourceValue(value);
  };

  const handleSaveManifest = () => {
    setEditorErrorLine(undefined);
    let bundle: unknown;
    try {
      if (sourceLanguage === "yaml") {
        bundle = yaml.load(sourceValue);
        if (typeof bundle === "string" || typeof bundle === "number" || bundle === null) {
          showSnack("YAML must parse to an object (workflows, artifact_types, policies).");
          return;
        }
      } else {
        bundle = JSON.parse(sourceValue);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const yamlLine = e && typeof e === "object" && "mark" in e ? (e as { mark?: { line?: number } }).mark?.line : undefined;
      const oneBased = yamlLine != null ? yamlLine + 1 : (jsonErrorLine(sourceValue, e) ?? 1);
      setEditorErrorLine(oneBased);
      showSnack(yamlLine != null ? `Parse error at line ${oneBased}: ${msg}` : (sourceLanguage === "yaml" ? "Invalid YAML. Fix syntax before saving." : `Invalid JSON at line ${oneBased}. Fix syntax before saving.`));
      return;
    }
    if (typeof bundle !== "object" || bundle === null || Array.isArray(bundle)) {
      showSnack("Manifest must be an object (workflows, artifact_types, policies).");
      return;
    }
    const bundleObj = bundle as Record<string, unknown>;
    syncDefsFromArtifactTypes(bundleObj);
    updateManifest.mutate(bundleObj as ManifestResponse["manifest_bundle"], {
      onSuccess: () => {
        setEditorErrorLine(undefined);
        showSnack("Manifest saved.");
      },
      onError: (err: unknown) => showSnack(getApiErrorMessage(err)),
    });
  };

  useEffect(() => {
    if (!snackOpen) return;
    const t = setTimeout(clearSnack, 6000);
    return () => clearTimeout(t);
  }, [snackOpen, clearSnack]);

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }
  if (is403 && orgSlug && projectSlug) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }
  if (projectSlug && orgSlug && projectsLoading) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <div className="flex items-center gap-2 text-muted-foreground">Loading project…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-6">
      <ProjectBreadcrumbs currentPageLabel="Process manifest" projectName={project?.name} />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[200px] rounded-md" />
        </div>
      ) : is404 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>This project has no process template assigned. Initialize a manifest to get started.</span>
          {project?.id && orgSlug ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateManifest.mutate(
                  {
                    workflows: [],
                    artifact_types: [],
                    link_types: [],
                  },
                  {
                    onSuccess: () => refetch(),
                    onError: () => {},
                  },
                )
              }
              disabled={updateManifest.isPending}
            >
              {updateManifest.isPending ? "Initializing…" : "Initialize manifest"}
            </Button>
          ) : null}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
          Could not load the manifest. Please try again later.
        </div>
      ) : manifest ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-2xl font-semibold">Process Manifest</h1>
            <Badge>{manifest.template_name}</Badge>
            <span className="text-sm text-muted-foreground">v{manifest.version}</span>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "workflow" | "preview" | "source")} className="border-b">
            <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger value="overview" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <LayoutGrid className="size-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="workflow" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <GitBranch className="size-4" />
                Workflow
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <Eye className="size-4" />
                Form preview
              </TabsTrigger>
              <TabsTrigger value="source" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <Code className="size-4" />
                Source
              </TabsTrigger>
            </TabsList>

            <TabsContent value="source" className="rounded-lg border p-4">
                {editorErrorLine != null && editorErrorLine >= 1 && (
                  <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive">
                    <span>Parse error at line {editorErrorLine}. Fix the syntax above and try again.</span>
                    <button type="button" onClick={() => setEditorErrorLine(undefined)} className="shrink-0 rounded p-1 hover:bg-destructive/20" aria-label="Dismiss">×</button>
                  </div>
                )}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Source format">
                    <button
                      type="button"
                      onClick={() => handleSourceLanguageChange("json")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium ${sourceLanguage === "json" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Braces className="size-4" />
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSourceLanguageChange("yaml")}
                      className={`inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium ${sourceLanguage === "yaml" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Code className="size-4" />
                      YAML
                    </button>
                  </div>
                  <Button onClick={handleSaveManifest} disabled={updateManifest.isPending}>
                    <Save className="size-4" />
                    {updateManifest.isPending ? "Saving…" : "Save manifest"}
                  </Button>
                </div>
                <ManifestEditor
                  value={sourceValue}
                  onChange={handleSourceChange}
                  language={sourceLanguage}
                  readOnly={false}
                  height={480}
                  errorLine={editorErrorLine}
                />
            </TabsContent>

            <TabsContent value="workflow">
                <WorkflowDesignerView
                  workflows={(manifest.manifest_bundle?.workflows ?? []) as Array<{ id: string; name?: string; states?: Array<{ id: string; name?: string; category?: string }>; transitions?: Array<{ from: string; to: string }> }>}
                  editable
                  isSaving={updateManifest.isPending}
                  onSaveWorkflow={(updatedWorkflow) => {
                    const bundle = { ...manifest.manifest_bundle } as Record<string, unknown>;
                    const workflows = Array.isArray(bundle.workflows) ? [...bundle.workflows] : [];
                    const idx = workflows.findIndex((w: { id?: string }) => (w as { id?: string }).id === updatedWorkflow.id);
                    if (idx >= 0) workflows[idx] = updatedWorkflow;
                    else workflows.push(updatedWorkflow);
                    updateManifest.mutate(
                      { ...bundle, workflows } as ManifestResponse["manifest_bundle"],
                      {
                        onSuccess: () => showSnack("Workflow saved."),
                        onError: (err: unknown) => showSnack(getApiErrorMessage(err, "Failed to save workflow.")),
                      },
                    );
                  }}
                />
            </TabsContent>

            {previewSchema && (
              <TabsContent value="preview">
                <div className="rounded-lg border p-6">
                  <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Eye className="size-4" />
                    Artifact form preview (from manifest)
                  </p>
                  <MetadataDrivenForm
                    schema={previewSchema}
                    values={previewValues}
                    onChange={setPreviewValues}
                    onSubmit={() => {}}
                    submitLabel="Create (preview only)"
                    disabled
                    submitExternally
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is a live preview of the create-artifact form derived from the manifest. Submit is disabled.
                  </p>
                </div>
              </TabsContent>
            )}

            <TabsContent value="overview">
                  <div className="rounded-lg border p-6">
                    <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <GitBranch className="size-4" />
                      Workflows
                    </p>
                    {manifest.manifest_bundle.workflows && manifest.manifest_bundle.workflows.length > 0 ? (
                      <pre className="overflow-auto rounded bg-muted/50 p-4 font-mono text-[13px]">
                        {JSON.stringify(manifest.manifest_bundle.workflows, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No workflows defined.</p>
                    )}
                  </div>

                  <div className="rounded-lg border p-6">
                    <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <Shield className="size-4" />
                      Policies
                    </p>
                    {manifest.manifest_bundle.policies && manifest.manifest_bundle.policies.length > 0 ? (
                      <pre className="overflow-auto rounded bg-muted/50 p-4 font-mono text-[13px]">
                        {JSON.stringify(manifest.manifest_bundle.policies, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-sm text-muted-foreground">No policies defined.</p>
                    )}
                  </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}

      {snackOpen && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border bg-card px-4 py-3 shadow-lg"
          role="status"
        >
          {snackMessage}
        </div>
      )}
    </div>
  );
}
