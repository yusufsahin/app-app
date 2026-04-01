import type { ChangeEvent } from "react";
import { useMemo, useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ExternalLink, MessageSquarePlus, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useArtifacts, useCreateArtifact } from "../../../shared/api/artifactApi";
import { useFormSchema } from "../../../shared/api/formSchemaApi";
import { useListSchema } from "../../../shared/api/listSchemaApi";
import { useOrgMembers } from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
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
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../shared/components/ui";
import { useCreateArtifactCommentMutation } from "../../../shared/api/commentApi";
import { LoadingState } from "../../../shared/components/LoadingState";
import {
  artifactDetailPath,
  artifactsPath,
  qualityDefectsPath,
  qualityPath,
} from "../../../shared/utils/appPaths";
import { modalApi, useModalStore } from "../../../shared/modal";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";
import { MetadataDrivenGrid } from "../../../shared/components/lists/MetadataDrivenGrid";
import type { TabularColumnModel } from "../../../shared/components/lists/types";
import { schemaToGridColumns } from "../../../shared/components/lists/schemaToGridColumns";
import { mapLookupItems } from "../../../shared/components/lists/lookupResolvers";
import { buildArtifactCreatePayload } from "../../artifacts/lib/buildArtifactCreatePayload";
import { pickDefectArtifactType } from "../lib/defectManifestHelpers";
import type { ProblemDetail } from "../../../shared/api/types";
import { getArtifactCellValue } from "../../artifacts/utils";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { buildSimilarDefectSearchQuery } from "../lib/similarDefectSearch";

const PAGE_SIZE = 40;

const UNDER_FOLDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDefectListCustomValue(
  artifact: Artifact,
  fieldKey: string,
  memberLabels: Map<string, string>,
): string {
  if (fieldKey === "detected_by") {
    const id = artifact.custom_fields?.[fieldKey] as string | undefined;
    if (!id) return "";
    return memberLabels.get(id) ?? id;
  }
  const v = getArtifactCellValue(artifact, fieldKey);
  if (v == null || v === "") return "";
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseExecutionContextSummary(customFields: Record<string, unknown> | undefined): string {
  const raw = customFields?.execution_context_json;
  let parsed: Record<string, unknown> | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) parsed = raw as Record<string, unknown>;
  else if (typeof raw === "string") {
    try {
      const decoded = JSON.parse(raw) as unknown;
      if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
        parsed = decoded as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }
  if (!parsed) return "";
  const runId = typeof parsed.run_id === "string" ? parsed.run_id.slice(0, 8) : "";
  const stepOrder = typeof parsed.step_order === "number" ? parsed.step_order : null;
  const stepName = typeof parsed.step_name === "string" ? parsed.step_name : "";
  const source = typeof parsed.source === "string" ? parsed.source : "";
  const parts = [
    source === "manual_runner" ? "Manual Runner" : "",
    runId ? `Run ${runId}` : "",
    stepOrder != null ? `Step ${stepOrder}` : "",
    stepName || "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatArtifactDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/**
 * Defect triage list: defect tree subtree via the same artifact list API; detail opens in Artifacts.
 */
export default function QualityDefectsPage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const [searchParams, setSearchParams] = useSearchParams();

  const qFromUrl = searchParams.get("q")?.trim() ?? "";
  const stateFromUrl = searchParams.get("state")?.trim() ?? "";
  const pageFromUrl = parsePage(searchParams.get("page"));
  const underFolderIdFromUrl = useMemo(() => {
    const raw = searchParams.get("under")?.trim() ?? "";
    return raw && UNDER_FOLDER_UUID_RE.test(raw) ? raw : null;
  }, [searchParams]);

  const [searchDraft, setSearchDraft] = useState(qFromUrl);
  const [stateDraft, setStateDraft] = useState(stateFromUrl);
  const [viewMode, setViewMode] = useState<"classic" | "tabular">("classic");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    setSearchDraft(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    setStateDraft(stateFromUrl);
  }, [stateFromUrl]);

  const projectReady = Boolean(orgSlug && projectSlug && project?.id && !projectsLoading);

  const { data: rootProbe, isPending: rootPending } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    "root-defect",
    "updated_at",
    "desc",
    undefined,
    5,
    0,
    false,
    undefined,
    undefined,
    undefined,
    "defect",
    true,
    undefined,
    undefined,
    undefined,
    projectReady,
  );

  const rootDefectId = rootProbe?.items?.[0]?.id ?? null;
  const listQueryEnabled = !!rootDefectId;

  const permissions = useAuthStore((s) => s.permissions);
  const canCreateArtifact = hasPermission(permissions, "artifact:create");
  const canCommentArtifact = hasPermission(permissions, "artifact:comment");

  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const bundle = manifest?.manifest_bundle;
  const defectArtifactType = useMemo(() => pickDefectArtifactType(bundle), [bundle]);
  const { data: defectListSchema } = useListSchema(orgSlug, project?.id, "artifact", "defects");

  const { data: formSchema, isError: formSchemaError, error: formSchemaErr } = useFormSchema(
    orgSlug,
    project?.id,
    "artifact",
    "create",
    defectArtifactType,
  );
  const { data: defectEditSchema } = useFormSchema(
    orgSlug,
    project?.id,
    "artifact",
    "edit",
    defectArtifactType,
  );
  const formSchema403 = formSchemaError && (formSchemaErr as unknown as ProblemDetail)?.status === 403;

  const { data: members } = useOrgMembers(orgSlug);

  /** Defect quick-create: parent defaults to project defect root on the server; optional folder via ?under=. */
  const defectCreateFormSchema = useMemo(() => {
    if (!formSchema) return null;
    return {
      ...formSchema,
      fields: formSchema.fields.filter((f) => f.key !== "parent_id"),
    };
  }, [formSchema]);

  const initialFormValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of defectCreateFormSchema?.fields ?? []) {
      vals[f.key] = f.default_value ?? (f.key === "parent_id" ? null : "");
    }
    vals.artifact_type = defectArtifactType;
    return vals;
  }, [defectCreateFormSchema?.fields, defectArtifactType]);

  const createFormValuesRef = useRef<Record<string, unknown>>({});
  const [, setCreateFormErrors] = useState<Record<string, string>>({});
  const createMutation = useCreateArtifact(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [commentTarget, setCommentTarget] = useState<Artifact | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const createCommentMutation = useCreateArtifactCommentMutation(orgSlug, project?.id);

  const memberLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of members ?? []) {
      m.set(x.user_id, x.display_name || x.email || x.user_id);
    }
    return m;
  }, [members]);

  const handleCreateDefect = useCallback(
    async (currentValues?: Record<string, unknown>) => {
      const current: Record<string, unknown> = {
        ...(currentValues ?? createFormValuesRef.current),
      };
      if (underFolderIdFromUrl) current.parent_id = underFolderIdFromUrl;
      const result = buildArtifactCreatePayload(current);
      if (!result.ok) {
        setCreateFormErrors(result.errors);
        if (useModalStore.getState().modalType === "CreateArtifactModal") {
          useModalStore.getState().updateModalProps({ formErrors: result.errors });
        }
        showNotification(result.firstMessage, "error");
        return;
      }
      try {
        await createMutation.mutateAsync(result.payload);
        modalApi.closeModal();
        createFormValuesRef.current = {};
        setCreateFormErrors({});
        showNotification(t("defectsPage.createSuccess"));
      } catch (err) {
        const problem = err as unknown as ProblemDetail;
        const message =
          problem?.detail ?? (err instanceof Error ? err.message : t("defectsPage.createFailed"));
        showNotification(message, "error");
      }
    },
    [createMutation, showNotification, t, underFolderIdFromUrl],
  );

  const openNewDefectModal = useCallback(() => {
    setCreateFormErrors({});
    const values = { ...initialFormValues };
    createFormValuesRef.current = values;
    modalApi.openCreateArtifact(
      {
        formSchema: defectCreateFormSchema ?? null,
        formValues: values,
        formErrors: {},
        onFormChange: (v) => {
          createFormValuesRef.current = v;
          setCreateFormErrors({});
          useModalStore.getState().updateModalProps({ formValues: v, formErrors: {} });
        },
        onFormErrors: (errs) => {
          setCreateFormErrors(errs);
          useModalStore.getState().updateModalProps({ formErrors: errs });
        },
        onCreate: (currentValues) => {
          void handleCreateDefect(currentValues);
        },
        isPending: createMutation.isPending,
        parentArtifacts: [],
        userOptions:
          members?.map((m) => ({
            id: m.user_id,
            label: m.display_name || m.email || m.user_id,
          })) ?? [],
        artifactTypeParentMap: {},
        formSchemaError: !!formSchemaError,
        formSchema403: !!formSchema403,
      },
      { title: t("defectsPage.newDefectModalTitle") },
    );
  }, [
    initialFormValues,
    defectCreateFormSchema,
    handleCreateDefect,
    createMutation.isPending,
    members,
    formSchemaError,
    formSchema403,
    t,
  ]);

  const showNewDefectButton =
    canCreateArtifact &&
    projectReady &&
    !!rootDefectId &&
    !rootPending &&
    !!formSchema &&
    !formSchemaError &&
    !formSchema403;

  const offset = (pageFromUrl - 1) * PAGE_SIZE;

  const { data: listResult, isLoading: listLoading, isFetching: listFetching } = useArtifacts(
    orgSlug,
    project?.id,
    stateFromUrl || undefined,
    undefined,
    "updated_at",
    "desc",
    qFromUrl || undefined,
    PAGE_SIZE,
    offset,
    false,
    undefined,
    undefined,
    undefined,
    "defect",
    false,
    underFolderIdFromUrl,
    undefined,
    undefined,
    listQueryEnabled,
  );

  const items = listResult?.items ?? [];
  const total = listResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!listQueryEnabled || listLoading || listFetching) return;
    if (total <= 0) return;
    if (pageFromUrl <= totalPages) return;
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("page");
        return n;
      },
      { replace: true },
    );
  }, [
    listQueryEnabled,
    listLoading,
    listFetching,
    total,
    totalPages,
    pageFromUrl,
    setSearchParams,
  ]);

  const qualityBase = orgSlug && projectSlug ? qualityPath(orgSlug, projectSlug) : "#";
  const artifactsBase = orgSlug && projectSlug ? artifactsPath(orgSlug, projectSlug) : "#";

  const onFilterSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchDraft.trim();
    const st = stateDraft.trim();
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (q) n.set("q", q);
        else n.delete("q");
        if (st) n.set("state", st);
        else n.delete("state");
        n.delete("page");
        return n;
      },
      { replace: true },
    );
  };

  const setPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (next <= 1) n.delete("page");
        else n.set("page", String(next));
        return n;
      },
      { replace: true },
    );
  };

  const defectsPathBuilder = useMemo(() => {
    if (!orgSlug || !projectSlug) return null;
    const underDefault = underFolderIdFromUrl ?? undefined;
    return (overrides?: { page?: number; q?: string; state?: string; under?: string | null }) =>
      qualityDefectsPath(orgSlug, projectSlug, {
        page: overrides?.page,
        q: overrides?.q ?? qFromUrl,
        state: overrides?.state ?? stateFromUrl,
        under:
          overrides?.under === null ? undefined : (overrides?.under ?? underDefault),
      });
  }, [orgSlug, projectSlug, qFromUrl, stateFromUrl, underFolderIdFromUrl]);

  const runFindSimilar = useCallback(
    (title: string) => {
      const q = buildSimilarDefectSearchQuery(title);
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (q) n.set("q", q);
          else n.delete("q");
          n.delete("page");
          return n;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const submitComment = useCallback(async () => {
    if (!commentTarget || !project?.id) return;
    const text = commentDraft.trim();
    if (!text) return;
    try {
      await createCommentMutation.mutateAsync({
        artifactId: commentTarget.id,
        body: text,
      });
      setCommentTarget(null);
      setCommentDraft("");
      showNotification(t("defectsPage.commentAdded"));
    } catch {
      showNotification(t("defectsPage.commentFailed"), "error");
    }
  }, [commentTarget, commentDraft, createCommentMutation, project?.id, showNotification, t]);

  const toggleExpanded = useCallback((artifactId: string) => {
    setExpandedIds((current) =>
      current.includes(artifactId) ? current.filter((id) => id !== artifactId) : [...current, artifactId],
    );
  }, []);

  const showRootMissing = projectReady && !rootPending && !rootDefectId;
  const listBusy = listLoading || listFetching;
  const showListLoading = listQueryEnabled && listBusy;
  const pageBeyondTotal = total > 0 && pageFromUrl > totalPages;
  const showPageOutOfRange =
    listQueryEnabled && !listBusy && items.length === 0 && pageBeyondTotal;
  const showEmpty =
    listQueryEnabled && !listBusy && items.length === 0 && !pageBeyondTotal;

  const defectGridColumns = useMemo<TabularColumnModel<Artifact>[]>(() => {
    const schemaColumns = schemaToGridColumns<Artifact>({
      listSchema: defectListSchema,
      formSchema: defectEditSchema,
      getCellValue: getArtifactCellValue,
      getContextValue: (row, key) => {
        if (key in row) return row[key as keyof Artifact];
        return row.custom_fields?.[key];
      },
      pinnedColumnKeys: ["title"],
      lookupSources: {
        user: mapLookupItems(
          members,
          (member) => member.user_id,
          (member) => member.display_name || member.email || member.user_id,
        ),
      },
    });

    return schemaColumns.map((column) => {
      if (column.key === "title") {
        return {
          ...column,
          width: 320,
          renderDisplay: (row: Artifact) => {
            const sevRaw = row.custom_fields?.severity;
            const severity = typeof sevRaw === "string" || typeof sevRaw === "number" ? String(sevRaw) : "";
            const assigneeName = row.assignee_id ? (memberLabels.get(row.assignee_id) ?? row.assignee_id) : "";
            const executionSummary = parseExecutionContextSummary(row.custom_fields);
            return (
              <div className="min-w-0 py-1">
                <p className="font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {row.artifact_key ?? "—"} · {row.artifact_type}
                  {row.state ? ` · ${row.state}` : ""}
                  {assigneeName ? ` · ${t("defectsPage.assigneeLabel")}: ${assigneeName}` : ""}
                  {severity ? ` · ${t("defectsPage.severityLabel")}: ${severity}` : ""}
                </p>
                {executionSummary ? (
                  <p className="mt-1 text-xs text-muted-foreground">{executionSummary}</p>
                ) : null}
              </div>
            );
          },
        };
      }

      return {
        ...column,
        isEditable: () => false,
        editorKind: "readonly",
        getDisplayValue: (row: Artifact, value: unknown) => {
          if (column.key === "assignee_id" && row.assignee_id) {
            return memberLabels.get(row.assignee_id) ?? row.assignee_id;
          }
          const formatted = formatDefectListCustomValue(row, column.fieldKey ?? column.key, memberLabels);
          if (formatted) return formatted;
          return column.getDisplayValue(row, value);
        },
      };
    });
  }, [defectEditSchema, defectListSchema, memberLabels, members, t]);

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  if (orgSlug && projectSlug && projectsLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-6 pt-6">
        <LoadingState label={t("defectsPage.loadingProject")} minHeight={200} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl min-h-0 flex-col gap-4 px-4 pb-6 pt-6">
      <div className="min-w-0 flex-1 space-y-4">
        <ProjectBreadcrumbs currentPageLabel={t("defectsPage.breadcrumb")} projectName={project?.name} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={qualityBase}>{t("defectsPage.backToQuality")}</Link>
          </Button>
          {orgSlug && projectSlug ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={artifactsBase}>{t("defectsPage.openArtifactsModule")}</Link>
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 space-y-1.5">
              <CardTitle>{t("defectsPage.title")}</CardTitle>
              <CardDescription>{t("defectsPage.description")}</CardDescription>
            </div>
            {showNewDefectButton ? (
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={openNewDefectModal}
                disabled={createMutation.isPending}
              >
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t("defectsPage.newDefect")}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {showRootMissing ? (
              <p className="text-sm text-muted-foreground">{t("defectsPage.noDefectRoot")}</p>
            ) : rootPending ? (
              <LoadingState label={t("defectsPage.loadingRoot")} minHeight={120} />
            ) : (
              <form onSubmit={onFilterSubmit} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <label htmlFor="quality-defects-q" className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("defectsPage.searchLabel")}
                  </label>
                  <Input
                    id="quality-defects-q"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    placeholder={t("defectsPage.searchPlaceholder")}
                    className="max-w-md"
                  />
                </div>
                <div className="w-full min-w-[120px] sm:w-40">
                  <label
                    htmlFor="quality-defects-state"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    {t("defectsPage.stateLabel")}
                  </label>
                  <Input
                    id="quality-defects-state"
                    value={stateDraft}
                    onChange={(e) => setStateDraft(e.target.value)}
                    placeholder={t("defectsPage.statePlaceholder")}
                  />
                </div>
                <Button type="submit" size="sm">
                  {t("defectsPage.applyFilters")}
                </Button>
                {(qFromUrl || stateFromUrl || underFolderIdFromUrl) && defectsPathBuilder ? (
                  <Button type="button" variant="ghost" size="sm" asChild>
                    <Link to={defectsPathBuilder({ q: "", state: "", under: null })}>
                      {t("defectsPage.clearFilters")}
                    </Link>
                  </Button>
                ) : null}
              </form>
            )}

            {showListLoading ? (
              <LoadingState label={t("defectsPage.loadingList")} minHeight={160} />
            ) : showPageOutOfRange ? (
              <p className="text-sm text-muted-foreground">{t("defectsPage.pageOutOfRange")}</p>
            ) : showEmpty ? (
              <p className="text-sm text-muted-foreground">{t("defectsPage.empty")}</p>
            ) : listQueryEnabled && !rootPending ? (
              <>
                <p className="text-xs text-muted-foreground">{t("defectsPage.resultCount", { total })}</p>
                {underFolderIdFromUrl ? (
                  <p className="text-xs text-muted-foreground">{t("defectsPage.listScopedToFolder")}</p>
                ) : null}
                <Tabs
                  value={viewMode}
                  onValueChange={(value) => setViewMode(value as "classic" | "tabular")}
                  className="w-full"
                >
                  <TabsList className="h-8 w-full flex-wrap justify-start gap-1 rounded-md sm:w-fit">
                    <TabsTrigger value="classic">{t("defectsPage.classicView")}</TabsTrigger>
                    <TabsTrigger value="tabular">{t("defectsPage.tabularView")}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="classic" className="mt-3">
                    <div className="overflow-hidden rounded-sm border border-border bg-background">
                      <div className="grid grid-cols-[minmax(0,2.3fr)_120px_150px_110px] gap-3 border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span>{t("defectsPage.classicHeaderTitle")}</span>
                        <span>{t("defectsPage.classicHeaderState")}</span>
                        <span>{t("defectsPage.classicHeaderUpdated")}</span>
                        <span>{t("defectsPage.classicHeaderPriority")}</span>
                      </div>

                      {items.map((row) => {
                      const severityRaw = row.custom_fields?.severity;
                      const severity =
                        typeof severityRaw === "string" || typeof severityRaw === "number"
                          ? String(severityRaw)
                          : "";
                      const assigneeName = row.assignee_id
                        ? (memberLabels.get(row.assignee_id) ?? row.assignee_id)
                        : "";
                      const detectedBy = formatDefectListCustomValue(row, "detected_by", memberLabels);
                      const environment = formatDefectListCustomValue(row, "environment", memberLabels);
                      const executionSummary = parseExecutionContextSummary(row.custom_fields);
                      const isExpanded = expandedIds.includes(row.id);

                      return (
                        <div key={row.id} className="border-b last:border-b-0">
                          <button
                            type="button"
                            className="grid w-full grid-cols-[minmax(0,2.3fr)_120px_150px_110px] items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/20"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-start gap-2">
                                <ChevronDown
                                  className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  aria-hidden
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold leading-5 text-foreground">
                                    {row.title}
                                  </p>
                                  <p className="truncate text-[11px] leading-4 text-muted-foreground">
                                    {row.artifact_key ?? "—"}
                                    {assigneeName ? ` · ${t("defectsPage.assigneeLabel")}: ${assigneeName}` : ""}
                                  </p>
                                  {executionSummary ? (
                                    <p className="truncate text-[11px] leading-4 text-muted-foreground">
                                      {executionSummary}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="pt-0.5 text-[13px] text-foreground">
                              {row.state || t("defectsPage.detailEmptyValue")}
                            </div>

                            <div className="pt-0.5 text-[13px] text-foreground">
                              {formatArtifactDate(row.updated_at)}
                            </div>

                            <div className="pt-0.5 text-[13px] text-foreground">
                              {severity || t("defectsPage.detailEmptyValue")}
                            </div>
                          </button>

                          {isExpanded ? (
                            <div className="border-t bg-muted/10 px-3 py-3">
                              <div className="grid gap-3 text-sm lg:grid-cols-[minmax(0,1.5fr)_300px]">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.detailDescriptionLabel")}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap break-words rounded-sm border bg-background px-2.5 py-2 text-[13px] leading-5">
                                      {row.description?.trim() || t("defectsPage.detailEmptyValue")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.detailExecutionLabel")}
                                    </p>
                                    <p className="mt-1 rounded-sm border bg-background px-2.5 py-2 text-[13px] leading-5">
                                      {executionSummary || t("defectsPage.detailEmptyValue")}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid gap-2 rounded-sm border bg-background p-2.5 sm:grid-cols-2 lg:grid-cols-1">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-medium text-muted-foreground">{t("defectsPage.stateLabel")}</p>
                                    <p className="text-[13px]">{row.state || t("defectsPage.detailEmptyValue")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.assigneeLabel")}
                                    </p>
                                    <p className="text-[13px]">{assigneeName || t("defectsPage.detailEmptyValue")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.severityLabel")}
                                    </p>
                                    <p className="text-[13px]">{severity || t("defectsPage.detailEmptyValue")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.detailDetectedByLabel")}
                                    </p>
                                    <p className="text-[13px]">{detectedBy || t("defectsPage.detailEmptyValue")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.detailEnvironmentLabel")}
                                    </p>
                                    <p className="text-[13px]">{environment || t("defectsPage.detailEmptyValue")}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      {t("defectsPage.detailUpdatedLabel")}
                                    </p>
                                    <p className="text-[13px]">{formatArtifactDate(row.updated_at)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => runFindSimilar(row.title)}
                                >
                                  <Search className="mr-1 size-3.5 shrink-0" aria-hidden />
                                  {t("defectsPage.findSimilar")}
                                </Button>
                                {canCommentArtifact ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      setCommentTarget(row);
                                      setCommentDraft("");
                                    }}
                                  >
                                    <MessageSquarePlus className="mr-1 size-3.5 shrink-0" aria-hidden />
                                    {t("defectsPage.addComment")}
                                  </Button>
                                ) : null}
                                {orgSlug && projectSlug ? (
                                  <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
                                    <Link to={artifactDetailPath(orgSlug, projectSlug, row.id)}>
                                      {t("defectsPage.openDetail")}
                                      <ExternalLink className="ml-1 size-3.5" />
                                    </Link>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    </div>
                  </TabsContent>

                  <TabsContent value="tabular" className="mt-3">
                    <MetadataDrivenGrid<Artifact>
                      columns={defectGridColumns}
                      data={items}
                      getRowKey={(row) => row.id}
                      emptyMessage={t("defectsPage.empty")}
                      renderRowActions={(row) => (
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => runFindSimilar(row.title)}
                            >
                              <Search className="mr-1 size-3.5 shrink-0" aria-hidden />
                              <span className="hidden sm:inline">{t("defectsPage.findSimilar")}</span>
                              <span className="sm:hidden">{t("defectsPage.findSimilarShort")}</span>
                            </Button>
                            {canCommentArtifact ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => {
                                  setCommentTarget(row);
                                  setCommentDraft("");
                                }}
                              >
                                <MessageSquarePlus className="mr-1 size-3.5 shrink-0" aria-hidden />
                                <span className="hidden sm:inline">{t("defectsPage.addComment")}</span>
                                <span className="sm:hidden">{t("defectsPage.addCommentShort")}</span>
                              </Button>
                            ) : null}
                          </div>
                          {orgSlug && projectSlug ? (
                            <Link
                              to={artifactDetailPath(orgSlug, projectSlug, row.id)}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {t("defectsPage.openDetail")}
                              <ExternalLink className="size-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      )}
                    />
                  </TabsContent>
                </Tabs>
                {totalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      {t("defectsPage.pageStatus", { page: pageFromUrl, totalPages })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pageFromUrl <= 1}
                        onClick={() => setPage(pageFromUrl - 1)}
                      >
                        {t("defectsPage.prev")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pageFromUrl >= totalPages}
                        onClick={() => setPage(pageFromUrl + 1)}
                      >
                        {t("defectsPage.next")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!commentTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCommentTarget(null);
            setCommentDraft("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("defectsPage.commentDialogTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("defectsPage.commentDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <p className="line-clamp-2 text-sm text-muted-foreground">{commentTarget?.title}</p>
          <textarea
            value={commentDraft}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCommentDraft(e.target.value)}
            placeholder={t("defectsPage.commentPlaceholder")}
            disabled={createCommentMutation.isPending}
            className="border-input placeholder:text-muted-foreground flex min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCommentTarget(null);
                setCommentDraft("");
              }}
              disabled={createCommentMutation.isPending}
            >
              {t("defectsPage.commentCancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void submitComment()}
              disabled={createCommentMutation.isPending || !commentDraft.trim()}
            >
              {t("defectsPage.commentSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
