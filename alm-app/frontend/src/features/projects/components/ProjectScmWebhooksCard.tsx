import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UseMutationResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, GitBranch, Loader2, RotateCcw, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
} from "../../../shared/components/ui";
import type { UpdateProjectRequest } from "../../../shared/api/orgApi";
import type { Project } from "../../../shared/api/types";
import {
  dismissScmWebhookUnmatchedEvent,
  scmWebhookUnmatchedEventsRootKey,
  undismissScmWebhookUnmatchedEvent,
  useScmWebhookUnmatchedEvents,
  type ScmUnmatchedTriage,
} from "../../../shared/api/scmWebhookUnmatchedApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { hasPermission } from "../../../shared/utils/permissions";

const GITHUB_SECRET_KEY = "scm_github_webhook_secret";
const GITLAB_SECRET_KEY = "scm_gitlab_webhook_secret";
const GITHUB_WEBHOOK_ENABLED_KEY = "scm_webhook_github_enabled";
const GITLAB_WEBHOOK_ENABLED_KEY = "scm_webhook_gitlab_enabled";
const PUSH_BRANCH_REGEX_KEY = "scm_webhook_push_branch_regex";
const DEPLOY_SECRET_KEY = "deploy_webhook_secret";

function webhookBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api/v1`;
}

function hasWebhookSecret(settings: Record<string, unknown> | null | undefined, key: string): boolean {
  const v = settings?.[key];
  return typeof v === "string" && v.length > 0;
}

function githubSecretConfigured(project: Project): boolean {
  if (typeof project.scm_webhook_github_secret_configured === "boolean") {
    return project.scm_webhook_github_secret_configured;
  }
  return hasWebhookSecret(project.settings ?? undefined, GITHUB_SECRET_KEY);
}

function gitlabSecretConfigured(project: Project): boolean {
  if (typeof project.scm_webhook_gitlab_secret_configured === "boolean") {
    return project.scm_webhook_gitlab_secret_configured;
  }
  return hasWebhookSecret(project.settings ?? undefined, GITLAB_SECRET_KEY);
}

function deploySecretConfigured(project: Project): boolean {
  if (typeof project.deploy_webhook_secret_configured === "boolean") {
    return project.deploy_webhook_secret_configured;
  }
  return hasWebhookSecret(project.settings ?? undefined, DEPLOY_SECRET_KEY);
}

export function ProjectScmWebhooksCard({
  orgSlug,
  project,
  updateProject,
}: {
  orgSlug: string;
  project: Project;
  updateProject: UseMutationResult<Project, Error, UpdateProjectRequest>;
}) {
  const { t } = useTranslation();
  const projectId = project.id;
  const base = webhookBaseUrl();
  const githubUrl = `${base}/orgs/${orgSlug}/projects/${projectId}/webhooks/github`;
  const gitlabUrl = `${base}/orgs/${orgSlug}/projects/${projectId}/webhooks/gitlab`;
  const deployUrl = `${base}/orgs/${orgSlug}/projects/${projectId}/webhooks/deploy`;

  const deployCurlExample = useMemo(() => {
    const body = '{"environment":"prod","occurred_at":"2026-04-07T12:00:00Z","build_id":"ci-1"}';
    return [
      "# macOS / Linux (OpenSSL). Replace YOUR_DEPLOY_WEBHOOK_SECRET.",
      `DEPLOY_URL='${deployUrl}'`,
      "SECRET='YOUR_DEPLOY_WEBHOOK_SECRET'",
      `BODY='${body}'`,
      `SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')`,
      'curl -sS -X POST "$DEPLOY_URL" \\',
      '  -H "Content-Type: application/json" \\',
      '  -H "X-Hub-Signature-256: sha256=$SIG" \\',
      '  -H "X-ALM-Deploy-Delivery: pipeline-1" \\',
      '  -d "$BODY"',
    ].join("\n");
  }, [deployUrl]);

  const deployActionsExample = useMemo(
    () =>
      [
        "      - name: Notify ALM deploy",
        "        env:",
        "          DEPLOY_URL: ${{ secrets.ALM_DEPLOY_WEBHOOK_URL }}",
        "          SECRET: ${{ secrets.ALM_DEPLOY_WEBHOOK_SECRET }}",
        "        run: |",
        "          BODY='{\"environment\":\"prod\",\"occurred_at\":\"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'\",\"build_id\":\"'${{ github.run_id }}'\"}'",
        "          SIG=$(printf '%s' \"$BODY\" | openssl dgst -sha256 -hmac \"$SECRET\" | sed 's/^.* //')",
        "          curl -sS -X POST \"$DEPLOY_URL\" \\",
        "            -H \"Content-Type: application/json\" \\",
        "            -H \"X-Hub-Signature-256: sha256=$SIG\" \\",
        "            -H \"X-ALM-Deploy-Delivery: ${{ github.run_id }}-${{ github.run_attempt }}\" \\",
        "            -d \"$BODY\"",
      ].join("\n"),
    [],
  );

  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((s) => s.showNotification);
  const permissions = useAuthStore((s) => s.permissions);
  const canTriageUnmatched = hasPermission(permissions, "project:update");

  const [includeDismissed, setIncludeDismissed] = useState(false);
  const triage: ScmUnmatchedTriage = includeDismissed ? "all" : "open";
  const { data: unmatched = [], isLoading, isError } = useScmWebhookUnmatchedEvents(orgSlug, projectId, 40, triage);

  const formatUnmatchedTime = useCallback(
    (iso: string) => {
      if (!iso) return t("projectScmWebhooks.dash");
      try {
        return new Date(iso).toLocaleString();
      } catch {
        return iso;
      }
    },
    [t],
  );

  const contextSnippet = useCallback(
    (ctx: Record<string, unknown>) => {
      const branch = typeof ctx.branch === "string" ? ctx.branch : "";
      const title = typeof ctx.title === "string" ? ctx.title : "";
      const body = typeof ctx.body_excerpt === "string" ? ctx.body_excerpt : "";
      const msg = typeof ctx.message_excerpt === "string" ? ctx.message_excerpt : "";
      const hints = Array.isArray(ctx.hints_tried) ? (ctx.hints_tried as string[]).join(", ") : "";
      const parts = [
        branch && t("projectScmWebhooks.snippetBranch", { value: branch }),
        title && t("projectScmWebhooks.snippetTitle", { value: title }),
        body && t("projectScmWebhooks.snippetBody", { value: body }),
        msg && t("projectScmWebhooks.snippetMsg", { value: msg }),
        hints && t("projectScmWebhooks.snippetHints", { value: hints }),
      ].filter(Boolean) as string[];
      return parts.length ? parts.join(" · ") : t("projectScmWebhooks.dash");
    },
    [t],
  );

  const [triagePendingId, setTriagePendingId] = useState<string | null>(null);

  const refreshUnmatched = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: scmWebhookUnmatchedEventsRootKey(orgSlug, projectId) });
  }, [queryClient, orgSlug, projectId]);

  const runDismiss = useCallback(
    async (eventId: string, mode: "dismiss" | "undismiss") => {
      setTriagePendingId(eventId);
      try {
        if (mode === "dismiss") {
          await dismissScmWebhookUnmatchedEvent(orgSlug, projectId, eventId);
          showNotification(t("projectScmWebhooks.notifyUnmatchedDismissed"));
        } else {
          await undismissScmWebhookUnmatchedEvent(orgSlug, projectId, eventId);
          showNotification(t("projectScmWebhooks.notifyUnmatchedRestored"));
        }
        refreshUnmatched();
        void queryClient.invalidateQueries({
          queryKey: ["orgs", orgSlug, "projects", projectId, "webhooks"],
        });
      } catch {
        showNotification(t("projectScmWebhooks.notifyTriageError"), "error");
      } finally {
        setTriagePendingId(null);
      }
    },
    [orgSlug, projectId, queryClient, refreshUnmatched, showNotification, t],
  );

  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  const [githubSecret, setGithubSecret] = useState("");
  const [gitlabSecret, setGitlabSecret] = useState("");
  const [deploySecret, setDeploySecret] = useState("");
  const [removeGithubSecret, setRemoveGithubSecret] = useState(false);
  const [removeGitlabSecret, setRemoveGitlabSecret] = useState(false);
  const [removeDeploySecret, setRemoveDeploySecret] = useState(false);

  const serverGhPaused = project.settings?.[GITHUB_WEBHOOK_ENABLED_KEY] === false;
  const serverGlPaused = project.settings?.[GITLAB_WEBHOOK_ENABLED_KEY] === false;
  const serverPushRegex =
    typeof project.settings?.[PUSH_BRANCH_REGEX_KEY] === "string"
      ? (project.settings[PUSH_BRANCH_REGEX_KEY] as string).trim()
      : "";

  const [policyGhPausedOverride, setPolicyGhPausedOverride] = useState<boolean | undefined>(undefined);
  const [policyGlPausedOverride, setPolicyGlPausedOverride] = useState<boolean | undefined>(undefined);
  const [pushBranchRegexOverride, setPushBranchRegexOverride] = useState<string | undefined>(undefined);

  const ghPaused = policyGhPausedOverride !== undefined ? policyGhPausedOverride : serverGhPaused;
  const glPaused = policyGlPausedOverride !== undefined ? policyGlPausedOverride : serverGlPaused;
  const pushBranchRegex =
    pushBranchRegexOverride !== undefined
      ? pushBranchRegexOverride
      : typeof project.settings?.[PUSH_BRANCH_REGEX_KEY] === "string"
        ? (project.settings[PUSH_BRANCH_REGEX_KEY] as string)
        : "";

  const ghConfigured = githubSecretConfigured(project);
  const glConfigured = gitlabSecretConfigured(project);
  const depConfigured = deploySecretConfigured(project);

  const policyDirty =
    ghPaused !== serverGhPaused ||
    glPaused !== serverGlPaused ||
    pushBranchRegex.trim() !== serverPushRegex;

  const canSaveSecrets =
    removeGithubSecret ||
    removeGitlabSecret ||
    removeDeploySecret ||
    githubSecret.trim().length > 0 ||
    gitlabSecret.trim().length > 0 ||
    deploySecret.trim().length > 0;

  const canSaveWebhookSettings = canSaveSecrets || policyDirty;

  const saveWebhookSettings = () => {
    const next: Record<string, unknown> = { ...(project.settings ?? {}) };
    if (removeGithubSecret) {
      delete next[GITHUB_SECRET_KEY];
    } else if (githubSecret.trim()) {
      next[GITHUB_SECRET_KEY] = githubSecret.trim();
    }
    if (removeGitlabSecret) {
      delete next[GITLAB_SECRET_KEY];
    } else if (gitlabSecret.trim()) {
      next[GITLAB_SECRET_KEY] = gitlabSecret.trim();
    }
    if (removeDeploySecret) {
      delete next[DEPLOY_SECRET_KEY];
    } else if (deploySecret.trim()) {
      next[DEPLOY_SECRET_KEY] = deploySecret.trim();
    }

    if (ghPaused) {
      next[GITHUB_WEBHOOK_ENABLED_KEY] = false;
    } else {
      delete next[GITHUB_WEBHOOK_ENABLED_KEY];
    }
    if (glPaused) {
      next[GITLAB_WEBHOOK_ENABLED_KEY] = false;
    } else {
      delete next[GITLAB_WEBHOOK_ENABLED_KEY];
    }
    const rx = pushBranchRegex.trim();
    if (rx) {
      next[PUSH_BRANCH_REGEX_KEY] = rx;
    } else {
      delete next[PUSH_BRANCH_REGEX_KEY];
    }

    updateProject.mutate(
      { settings: next },
      {
        onSuccess: () => {
          showNotification(t("projectScmWebhooks.notifyWebhookSettingsSaved"));
          setGithubSecret("");
          setGitlabSecret("");
          setDeploySecret("");
          setRemoveGithubSecret(false);
          setRemoveGitlabSecret(false);
          setRemoveDeploySecret(false);
          setPolicyGhPausedOverride(undefined);
          setPolicyGlPausedOverride(undefined);
          setPushBranchRegexOverride(undefined);
          queryClient.invalidateQueries({
            queryKey: ["orgs", orgSlug, "projects", projectId, "webhooks"],
          });
        },
      },
    );
  };

  return (
    <Card className="border border-border">
      <CardContent className="pt-6">
        <p className="mb-1 flex items-center gap-2 font-semibold">
          <GitBranch className="size-4" />
          {t("projectScmWebhooks.title")}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">{t("projectScmWebhooks.intro")}</p>

        <div className="mb-6 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("projectScmWebhooks.github")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full flex-1 overflow-x-auto rounded border border-border bg-muted/40 px-2 py-1.5 text-xs">
                {githubUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label={t("projectScmWebhooks.copyGithubUrlAria")}
                onClick={() => copy("gh", githubUrl)}
              >
                {copied === "gh" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("projectScmWebhooks.gitlab")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full flex-1 overflow-x-auto rounded border border-border bg-muted/40 px-2 py-1.5 text-xs">
                {gitlabUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label={t("projectScmWebhooks.copyGitlabUrlAria")}
                onClick={() => copy("gl", gitlabUrl)}
              >
                {copied === "gl" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("projectScmWebhooks.deployTitle")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full flex-1 overflow-x-auto rounded border border-border bg-muted/40 px-2 py-1.5 text-xs">
                {deployUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label={t("projectScmWebhooks.copyDeployUrlAria")}
                onClick={() => copy("dep", deployUrl)}
              >
                {copied === "dep" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("projectScmWebhooks.deployHint")}</p>
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("projectScmWebhooks.deployCurlTitle")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label={t("projectScmWebhooks.deployCurlCopyAria")}
                  onClick={() => copy("curl", deployCurlExample)}
                >
                  {copied === "curl" ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <pre className="max-h-48 max-w-full overflow-auto rounded border border-border bg-muted/40 p-2 text-[10px] leading-relaxed">
                {deployCurlExample}
              </pre>
              <p className="text-[10px] text-muted-foreground">{t("projectScmWebhooks.deployCurlHelp")}</p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t("projectScmWebhooks.deployActionsTitle")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-label={t("projectScmWebhooks.deployActionsCopyAria")}
                  onClick={() => copy("gha", deployActionsExample)}
                >
                  {copied === "gha" ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <pre className="max-h-48 max-w-full overflow-auto rounded border border-border bg-muted/40 p-2 text-[10px] leading-relaxed">
                {deployActionsExample}
              </pre>
              <p className="text-[10px] text-muted-foreground">{t("projectScmWebhooks.deployActionsHelp")}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-2 text-xs text-muted-foreground">
          <p>{t("projectScmWebhooks.payloadLimitHint")}</p>
          <p>{t("projectScmWebhooks.deliveryIdempotencyHint")}</p>
        </div>

        <p className="mb-6 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">{t("projectScmWebhooks.refsHintStrong")}</span>{" "}
          {t("projectScmWebhooks.refsHintBeforeCode")}{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{`Refs: <task-uuid>`}</code>{" "}
          {t("projectScmWebhooks.refsHintAfterCode")}
        </p>

        <div className="mb-6 rounded-lg border border-border bg-muted/15 p-4">
          <p className="mb-2 text-sm font-medium">{t("projectScmWebhooks.policyTitle")}</p>
          <p className="mb-4 text-xs text-muted-foreground">{t("projectScmWebhooks.policyHelp")}</p>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ghPaused}
                onCheckedChange={(v) => setPolicyGhPausedOverride(v === true)}
              />
              {t("projectScmWebhooks.pauseGithub")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={glPaused}
                onCheckedChange={(v) => setPolicyGlPausedOverride(v === true)}
              />
              {t("projectScmWebhooks.pauseGitlab")}
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="scm-push-branch-regex">{t("projectScmWebhooks.pushBranchRegexLabel")}</Label>
              <Input
                id="scm-push-branch-regex"
                autoComplete="off"
                className="font-mono text-xs"
                placeholder={t("projectScmWebhooks.pushBranchRegexPlaceholder")}
                value={pushBranchRegex}
                onChange={(e) => setPushBranchRegexOverride(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">{t("projectScmWebhooks.pushBranchRegexHelp")}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-muted/20 p-4">
          <p className="mb-3 text-sm font-medium">{t("projectScmWebhooks.webhookSecretsTitle")}</p>
          <p className="mb-4 text-xs text-muted-foreground">{t("projectScmWebhooks.webhookSecretsHelp")}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="scm-gh-secret">{t("projectScmWebhooks.githubSecretLabel")}</Label>
                {ghConfigured ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("projectScmWebhooks.configured")}
                  </Badge>
                ) : null}
              </div>
              <Input
                id="scm-gh-secret"
                type="password"
                autoComplete="off"
                placeholder={ghConfigured ? t("projectScmWebhooks.githubPlaceholderNew") : t("projectScmWebhooks.githubPlaceholder")}
                value={githubSecret}
                onChange={(e) => setGithubSecret(e.target.value)}
                disabled={removeGithubSecret}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={removeGithubSecret}
                  onCheckedChange={(v) => {
                    setRemoveGithubSecret(v === true);
                    if (v === true) setGithubSecret("");
                  }}
                />
                {t("projectScmWebhooks.removeGithubSecret")}
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="scm-gl-secret">{t("projectScmWebhooks.gitlabTokenLabel")}</Label>
                {glConfigured ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("projectScmWebhooks.configured")}
                  </Badge>
                ) : null}
              </div>
              <Input
                id="scm-gl-secret"
                type="password"
                autoComplete="off"
                placeholder={
                  glConfigured ? t("projectScmWebhooks.gitlabPlaceholderNew") : t("projectScmWebhooks.gitlabPlaceholder")
                }
                value={gitlabSecret}
                onChange={(e) => setGitlabSecret(e.target.value)}
                disabled={removeGitlabSecret}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={removeGitlabSecret}
                  onCheckedChange={(v) => {
                    setRemoveGitlabSecret(v === true);
                    if (v === true) setGitlabSecret("");
                  }}
                />
                {t("projectScmWebhooks.removeGitlabSecret")}
              </label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="deploy-wh-secret">{t("projectScmWebhooks.deploySecretLabel")}</Label>
                {depConfigured ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {t("projectScmWebhooks.configured")}
                  </Badge>
                ) : null}
              </div>
              <Input
                id="deploy-wh-secret"
                type="password"
                autoComplete="off"
                placeholder={
                  depConfigured ? t("projectScmWebhooks.deployPlaceholderNew") : t("projectScmWebhooks.deployPlaceholder")
                }
                value={deploySecret}
                onChange={(e) => setDeploySecret(e.target.value)}
                disabled={removeDeploySecret}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={removeDeploySecret}
                  onCheckedChange={(v) => {
                    setRemoveDeploySecret(v === true);
                    if (v === true) setDeploySecret("");
                  }}
                />
                {t("projectScmWebhooks.removeDeploySecret")}
              </label>
            </div>
          </div>
          <Button
            type="button"
            className="mt-4"
            disabled={!canSaveWebhookSettings || updateProject.isPending}
            onClick={saveWebhookSettings}
          >
            {updateProject.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("projectScmWebhooks.savingWebhookSettings")}
              </>
            ) : (
              t("projectScmWebhooks.saveWebhookSettings")
            )}
          </Button>
        </div>

        <p className="mb-2 text-sm font-medium">{t("projectScmWebhooks.unmatchedTitle")}</p>
        <p className="mb-3 text-xs text-muted-foreground">{t("projectScmWebhooks.unmatchedIntro")}</p>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={includeDismissed} onCheckedChange={(v) => setIncludeDismissed(v === true)} />
          {t("projectScmWebhooks.includeDismissed")}
        </label>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">{t("projectScmWebhooks.unmatchedLoadError")}</p>
        ) : unmatched.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("projectScmWebhooks.unmatchedEmpty")}</p>
        ) : (
          <div className="max-h-72 overflow-auto rounded border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-border bg-muted/60">
                <tr>
                  <th className="px-2 py-2 font-medium">{t("projectScmWebhooks.colWhen")}</th>
                  <th className="px-2 py-2 font-medium">{t("projectScmWebhooks.colKind")}</th>
                  <th className="px-2 py-2 font-medium">{t("projectScmWebhooks.colSummary")}</th>
                  <th className="px-2 py-2 font-medium">{t("projectScmWebhooks.colLink")}</th>
                  {canTriageUnmatched ? <th className="px-2 py-2 font-medium">{t("projectScmWebhooks.colTriage")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {unmatched.map((row) => {
                  const url = typeof row.context.web_url === "string" ? row.context.web_url : "";
                  const isDismissed = Boolean(row.dismissed_at);
                  const busy = triagePendingId === row.id;
                  return (
                    <tr key={row.id} className="border-b border-border/80 last:border-0">
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{formatUnmatchedTime(row.created_at)}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{row.kind}</span>
                          {isDismissed ? (
                            <Badge variant="outline" className="text-[10px]">
                              {t("projectScmWebhooks.dismissed")}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[240px] px-2 py-2 text-muted-foreground">{contextSnippet(row.context)}</td>
                      <td className="px-2 py-2">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {t("projectScmWebhooks.openLink")}
                          </a>
                        ) : (
                          t("projectScmWebhooks.dash")
                        )}
                      </td>
                      {canTriageUnmatched ? (
                        <td className="whitespace-nowrap px-2 py-2">
                          {isDismissed ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-xs"
                              disabled={busy}
                              onClick={() => void runDismiss(row.id, "undismiss")}
                            >
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                              {t("projectScmWebhooks.restore")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-xs"
                              disabled={busy}
                              onClick={() => void runDismiss(row.id, "dismiss")}
                            >
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                              {t("projectScmWebhooks.dismiss")}
                            </Button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
