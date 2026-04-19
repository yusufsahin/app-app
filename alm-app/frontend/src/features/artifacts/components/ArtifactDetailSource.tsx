import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Badge, Button, Input, Label, TabsContent } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import { RhfSelect } from "../../../shared/components/forms";
import {
  useCreateScmLink,
  useDeleteScmLink,
  useParseScmUrlPreview,
  useScmLinksByArtifact,
  type ScmLink,
} from "../../../shared/api/scmLinkApi";
import type { Task } from "../../../shared/api/taskApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import type { ProblemDetail } from "../../../shared/api/types";
import { artifactDetailPath } from "../../../shared/utils/appPaths";

type AddLinkForm = { web_url: string; task_id?: string; context_hint?: string };

interface ArtifactDetailSourceProps {
  orgSlug: string | undefined;
  projectSlug: string | undefined;
  projectId: string | undefined;
  artifactId: string | undefined;
  /** Work item key for SCM matching hints (branch/commit examples). */
  artifactKey?: string | null;
  tasks: Task[];
  canEdit: boolean;
  /** When set (e.g. backlog tree task focus), list + default add scope filter to this task. */
  taskScopeId?: string | null;
}

function ArtifactDetailSourcePanel({
  orgSlug,
  projectSlug,
  projectId,
  artifactId,
  artifactKey,
  tasks,
  canEdit,
  taskScopeId,
}: ArtifactDetailSourceProps) {
  const { t } = useTranslation("quality");
  const exampleKeyForHints = (artifactKey ?? "").trim() || "REQ-42";
  const showNotification = useNotificationStore((s) => s.showNotification);
  const [showAllScmLinks, setShowAllScmLinks] = useState(false);

  const listTaskFilter =
    taskScopeId && taskScopeId.trim() && !showAllScmLinks ? taskScopeId.trim() : undefined;
  const { data: links = [], isLoading } = useScmLinksByArtifact(orgSlug, projectId, artifactId, listTaskFilter);

  const keyMatchLabel = useCallback(
    (src: string | null | undefined) => {
      if (!src) return "";
      if (src === "branch") return t("workItemDetail.source.keyMatchBranch");
      if (src === "title") return t("workItemDetail.source.keyMatchTitle");
      if (src === "body") return t("workItemDetail.source.keyMatchBody");
      return src;
    },
    [t],
  );

  const scopedTaskTitle = useMemo(() => {
    if (!taskScopeId?.trim()) return "";
    return tasks.find((x) => x.id === taskScopeId)?.title ?? "";
  }, [taskScopeId, tasks]);
  const createMutation = useCreateScmLink(orgSlug, projectId, artifactId);
  const deleteMutation = useDeleteScmLink(orgSlug, projectId, artifactId);
  const previewMutation = useParseScmUrlPreview(orgSlug, projectId, artifactId);

  const addLinkSchema = useMemo(
    () =>
      z.object({
        web_url: z.string().min(1, t("workItemDetail.source.urlRequired")),
        task_id: z.string().optional(),
        context_hint: z.string().max(20000).optional(),
      }),
    [t],
  );

  const form = useForm<AddLinkForm>({
    resolver: zodResolver(addLinkSchema),
    defaultValues: { web_url: "", task_id: "", context_hint: "" },
  });
  const setTaskIdValue = form.setValue;

  useEffect(() => {
    if (taskScopeId?.trim() && !showAllScmLinks) {
      setTaskIdValue("task_id", taskScopeId.trim());
    }
  }, [taskScopeId, showAllScmLinks, setTaskIdValue]);

  const runPreview = () => {
    const url = form.getValues("web_url").trim();
    const ctx = form.getValues("context_hint")?.trim() ?? "";
    if (!url || !orgSlug || !projectId || !artifactId) {
      previewMutation.reset();
      return;
    }
    previewMutation.mutate(
      { web_url: url, ...(ctx ? { context_text: ctx } : {}) },
      {
        onSuccess: (data) => {
          const canon = (data.canonical_web_url ?? "").trim();
          if (canon && canon !== url) {
            form.setValue("web_url", canon, { shouldValidate: true });
          }
        },
        onError: () => {
          showNotification(t("workItemDetail.source.previewFailed"), "error");
        },
      },
    );
  };

  const taskOptions = useMemo(
    () => [
      { value: "", label: t("workItemDetail.source.scopeEntireArtifact") },
      ...tasks.map((task) => ({ value: task.id, label: task.title })),
    ],
    [t, tasks],
  );

  const onSubmit = (values: AddLinkForm) => {
    createMutation.mutate(
      {
        web_url: values.web_url.trim(),
        task_id: values.task_id?.trim() ? values.task_id.trim() : null,
      },
      {
        onSuccess: () => {
          showNotification(t("workItemDetail.source.added"), "success");
          previewMutation.reset();
          const nextTaskId =
            taskScopeId?.trim() && !showAllScmLinks
              ? taskScopeId.trim()
              : values.task_id?.trim()
                ? values.task_id.trim()
                : "";
          form.reset({ web_url: "", task_id: nextTaskId, context_hint: "" });
        },
        onError: (err: Error) => {
          const body = (err as unknown as { body?: ProblemDetail })?.body;
          showNotification(body?.detail ?? t("workItemDetail.source.addFailed"), "error");
        },
      },
    );
  };

  const onDelete = (link: ScmLink) => {
    deleteMutation.mutate(link.id, {
      onSuccess: () => showNotification(t("workItemDetail.source.removed"), "success"),
      onError: (err: Error) => {
        const body = (err as unknown as { body?: ProblemDetail })?.body;
        showNotification(body?.detail ?? t("workItemDetail.source.removeFailed"), "error");
      },
    });
  };

  return (
    <TabsContent value="source" className="py-2">
      {taskScopeId?.trim() ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-muted-foreground">
            {showAllScmLinks
              ? t("workItemDetail.source.showingAllLinks")
              : t("workItemDetail.source.taskScopeBanner", { task: scopedTaskTitle || t("workItemDetail.source.taskScopeUnknown") })}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAllScmLinks((v) => !v)}>
            {showAllScmLinks ? t("workItemDetail.source.showTaskScopedLinks") : t("workItemDetail.source.showAllScmLinks")}
          </Button>
        </div>
      ) : null}
      <p className="mb-3 text-sm text-muted-foreground">{t("workItemDetail.source.intro")}</p>
      <p className="mb-2 text-xs text-muted-foreground">
        {t("workItemDetail.source.matchPriorityHint", { exampleKey: exampleKeyForHints })}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">{t("workItemDetail.source.webhookRefsHint")}</p>
      {canEdit && (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 space-y-3 rounded-md border border-border p-3">
            <Controller<AddLinkForm>
              name="web_url"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="w-full space-y-1.5">
                  <Label htmlFor="scm-web-url">{t("workItemDetail.source.urlLabel")}</Label>
                  <Input
                    id="scm-web-url"
                    {...field}
                    placeholder={t("workItemDetail.source.urlPlaceholder")}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={
                      [fieldState.error ? "scm-web-url-error" : null, previewMutation.data || previewMutation.isPending ? "scm-web-url-preview" : null]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    onChange={(e) => {
                      field.onChange(e);
                      previewMutation.reset();
                    }}
                    onBlur={() => {
                      field.onBlur();
                      runPreview();
                    }}
                  />
                  {fieldState.error?.message != null && fieldState.error.message !== "" && (
                    <p id="scm-web-url-error" className="text-sm text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                  {(previewMutation.isPending || previewMutation.data) && (
                    <div id="scm-web-url-preview" className="space-y-1 text-sm text-muted-foreground">
                      {previewMutation.isPending && t("workItemDetail.source.previewChecking")}
                      {!previewMutation.isPending && previewMutation.data && (
                        <>
                          {previewMutation.data.recognized &&
                            previewMutation.data.provider &&
                            previewMutation.data.repo_full_name && (
                              <p>
                                {t("workItemDetail.source.previewParsed", {
                                  provider: previewMutation.data.provider,
                                  repo: previewMutation.data.repo_full_name,
                                  detail: previewMutation.data.suggested_title ?? "",
                                })}
                              </p>
                            )}
                          {!previewMutation.data.recognized && (
                            <p>{t("workItemDetail.source.previewUnrecognized")}</p>
                          )}
                          {(previewMutation.data.canonical_web_url ?? "").trim() !== "" && (
                            <p>
                              {t("workItemDetail.source.previewStoredAs", {
                                url: previewMutation.data.canonical_web_url,
                              })}
                            </p>
                          )}
                          {previewMutation.data.artifact_key_hints &&
                            previewMutation.data.artifact_key_hints.length > 0 && (
                              <p>
                                {t("workItemDetail.source.previewKeyHints", {
                                  keys: previewMutation.data.artifact_key_hints.join(", "),
                                })}
                              </p>
                            )}
                          {previewMutation.data.artifact_key_matches &&
                            previewMutation.data.artifact_key_matches.length > 0 && (
                              <ul className="list-inside list-disc space-y-0.5">
                                {previewMutation.data.artifact_key_matches.map((m) => (
                                  <li key={`${m.hint}-${m.artifact_id}`}>
                                    {m.is_current_artifact ? (
                                      t("workItemDetail.source.previewKeyMatchCurrent", { hint: m.hint })
                                    ) : orgSlug && projectSlug ? (
                                      <>
                                        {t("workItemDetail.source.previewKeyMatchOther", {
                                          hint: m.hint,
                                          key: m.artifact_key,
                                        })}{" "}
                                        <Link
                                          to={artifactDetailPath(orgSlug, projectSlug, m.artifact_id)}
                                          className="font-medium text-primary hover:underline"
                                        >
                                          {m.title}
                                        </Link>
                                      </>
                                    ) : (
                                      t("workItemDetail.source.previewKeyMatchOtherPlain", {
                                        hint: m.hint,
                                        key: m.artifact_key,
                                        title: m.title,
                                      })
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          {previewMutation.data.artifact_key_unmatched &&
                            previewMutation.data.artifact_key_unmatched.length > 0 && (
                              <p className="text-amber-700 dark:text-amber-500">
                                {t("workItemDetail.source.previewKeyUnmatched", {
                                  keys: previewMutation.data.artifact_key_unmatched.join(", "),
                                })}
                              </p>
                            )}
                          {(previewMutation.data.duplicate_kind ?? "none") !== "none" && (
                            <p className="text-amber-800 dark:text-amber-400">
                              {previewMutation.data.duplicate_kind === "url" &&
                                t("workItemDetail.source.previewDuplicateUrl")}
                              {previewMutation.data.duplicate_kind === "pull_request" &&
                                t("workItemDetail.source.previewDuplicatePr")}
                              {previewMutation.data.duplicate_kind === "commit" &&
                                t("workItemDetail.source.previewDuplicateCommit")}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            />
            <Controller<AddLinkForm>
              name="context_hint"
              control={form.control}
              render={({ field }) => (
                <div className="w-full space-y-1.5">
                  <Label htmlFor="scm-context-hint">{t("workItemDetail.source.contextHintLabel")}</Label>
                  <textarea
                    id="scm-context-hint"
                    rows={3}
                    {...field}
                    value={field.value ?? ""}
                    placeholder={t("workItemDetail.source.contextHintPlaceholder")}
                    className={cn(
                      "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm",
                      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                    )}
                    onChange={(e) => {
                      field.onChange(e);
                      previewMutation.reset();
                    }}
                    onBlur={() => {
                      field.onBlur();
                      runPreview();
                    }}
                  />
                </div>
              )}
            />
            <RhfSelect<AddLinkForm>
              name="task_id"
              control={form.control}
              label={t("workItemDetail.source.scopeLabel")}
              options={taskOptions}
            />
            <Button type="submit" size="sm" disabled={createMutation.isPending || previewMutation.isPending}>
              {createMutation.isPending ? t("workItemDetail.source.adding") : t("workItemDetail.source.add")}
            </Button>
          </form>
        </FormProvider>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">{t("workItemDetail.source.loading")}</p>}
      {!isLoading && links.length === 0 && (
        <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">
            {listTaskFilter ? t("workItemDetail.source.emptyScoped") : t("workItemDetail.source.empty")}
          </p>
          {!listTaskFilter && orgSlug && projectSlug ? (
            <>
              <p className="text-sm text-muted-foreground">{t("workItemDetail.source.emptyIntegrationsCta")}</p>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/${orgSlug}/${projectSlug}/integrations`}>{t("workItemDetail.source.integrationsLinkLabel")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      )}
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <a
                href={link.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <span className="truncate">{link.title ?? link.web_url}</span>
                <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
              </a>
              {link.source === "webhook" && link.key_match_source ? (
                <div className="mt-1">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {keyMatchLabel(link.key_match_source)}
                  </Badge>
                </div>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {link.provider} · {link.repo_full_name}
                {link.pull_request_number != null ? ` · PR #${link.pull_request_number}` : ""}
                {link.commit_sha ? ` · ${link.commit_sha.slice(0, 7)}` : ""}
                {link.task_id ? ` · ${t("workItemDetail.source.taskScoped")}` : ""}
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                aria-label={t("workItemDetail.source.removeAria")}
                disabled={deleteMutation.isPending}
                onClick={() => onDelete(link)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </TabsContent>
  );
}

/** Remount when artifact or task scope changes so expanded SCM list + form scope reset without setState-in-effect. */
export function ArtifactDetailSource(props: ArtifactDetailSourceProps) {
  const remountKey = `${props.artifactId ?? ""}::${props.taskScopeId ?? ""}`;
  return <ArtifactDetailSourcePanel key={remountKey} {...props} />;
}
