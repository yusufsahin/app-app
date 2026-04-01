import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardCopy, Loader2 } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  Input,
  Badge,
  Checkbox,
} from "../../../shared/components/ui";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useBacklogWorkspaceProject } from "./useBacklogWorkspaceProject";
import {
  useRequirementCoverageAnalysis,
  type RequirementCoverageLeaf,
  type RequirementCoverageNode,
} from "../../../shared/api/requirementCoverageApi";
import {
  artifactDetailPath,
  artifactsPath,
  qualityCatalogArtifactPath,
  qualityPath,
} from "../../../shared/utils/appPaths";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

const BAR_BUCKETS = [
  "failed",
  "blocked",
  "not-executed",
  "no_run",
  "not_covered",
  "passed",
] as const;

const BUCKET_CLASS: Record<string, string> = {
  failed: "bg-destructive",
  blocked: "bg-amber-600",
  "not-executed": "bg-yellow-500",
  no_run: "bg-slate-400",
  not_covered: "bg-sky-600",
  passed: "bg-emerald-600",
};

function isUuid(value: string | null): boolean {
  if (!value?.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function buildChildrenMap(nodes: RequirementCoverageNode[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const n of nodes) {
    if (!m.has(n.id)) m.set(n.id, []);
  }
  for (const n of nodes) {
    if (n.parent_id && m.has(n.parent_id)) {
      const arr = m.get(n.parent_id)!;
      arr.push(n.id);
    }
  }
  return m;
}

function collectDescendantIds(rootId: string, children: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const stack = [...(children.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) stack.push(c);
  }
  return out;
}

function depthById(nodes: RequirementCoverageNode[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const parent = new Map(nodes.map((n) => [n.id, n.parent_id]));
  const memo = new Map<string, number>();

  function depthOf(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const p = parent.get(id);
    if (!p || !ids.has(p)) {
      memo.set(id, 0);
      return 0;
    }
    const d = depthOf(p) + 1;
    memo.set(id, d);
    return d;
  }

  for (const n of nodes) depthOf(n.id);
  return memo;
}

export default function RequirementsCoveragePage() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [draftUnder, setDraftUnder] = useState(() => searchParams.get("under") ?? "");
  const [draftRun, setDraftRun] = useState(() => searchParams.get("scopeRun") ?? "");
  const [draftSuite, setDraftSuite] = useState(() => searchParams.get("scopeSuite") ?? "");
  const [draftCampaign, setDraftCampaign] = useState(() => searchParams.get("scopeCampaign") ?? "");
  const [draftIncludeReverse, setDraftIncludeReverse] = useState(
    () => searchParams.get("reverse") !== "0",
  );

  const appliedUnder = searchParams.get("under")?.trim() || undefined;
  const appliedRun = searchParams.get("scopeRun")?.trim() || undefined;
  const appliedSuite = searchParams.get("scopeSuite")?.trim() || undefined;
  const appliedCampaign = searchParams.get("scopeCampaign")?.trim() || undefined;
  const appliedRefresh = searchParams.get("refresh") === "1";
  const appliedIncludeReverse = searchParams.get("reverse") !== "0";

  const queryParams = useMemo(
    () => ({
      under: appliedUnder && isUuid(appliedUnder) ? appliedUnder : undefined,
      scopeRunId: appliedRun && isUuid(appliedRun) ? appliedRun : undefined,
      scopeSuiteId: appliedSuite && isUuid(appliedSuite) ? appliedSuite : undefined,
      scopeCampaignId: appliedCampaign && isUuid(appliedCampaign) ? appliedCampaign : undefined,
      refresh: appliedRefresh,
      includeReverseVerifies: appliedIncludeReverse,
    }),
    [
      appliedUnder,
      appliedRun,
      appliedSuite,
      appliedCampaign,
      appliedRefresh,
      appliedIncludeReverse,
    ],
  );

  const coverageQuery = useRequirementCoverageAnalysis(orgSlug, project?.id, queryParams, !!project?.id);

  const [dialog, setDialog] = useState<{
    node: RequirementCoverageNode;
    bucket: string;
    leaves: RequirementCoverageLeaf[];
  } | null>(null);

  const nodes = coverageQuery.data?.nodes;

  const childrenMap = useMemo(
    () => (nodes?.length ? buildChildrenMap(nodes) : new Map()),
    [nodes],
  );

  const depths = useMemo(() => (nodes?.length ? depthById(nodes) : new Map()), [nodes]);

  const sortedNodes = useMemo(() => {
    const list = nodes ?? [];
    return [...list].sort((a, b) => {
      const da = depths.get(a.id) ?? 0;
      const db = depths.get(b.id) ?? 0;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title);
    });
  }, [nodes, depths]);

  const statusLabel = useCallback(
    (s: string) =>
      t(`requirementCoverage.statusLabels.${s}` as never, { defaultValue: s }) as string,
    [t],
  );

  const openSegment = useCallback(
    (node: RequirementCoverageNode, bucket: string, leaves: RequirementCoverageLeaf[]) => {
      const desc = collectDescendantIds(node.id, childrenMap);
      const scoped = leaves.filter((leaf) => {
        if (leaf.id === node.id) return true;
        return desc.has(leaf.id);
      });
      const match = scoped.filter((l) => l.leaf_status === bucket);
      if (match.length === 0) return;
      setDialog({ node, bucket, leaves: match });
    },
    [childrenMap],
  );

  const copyTsv = useCallback(async () => {
    if (!coverageQuery.data?.nodes.length) return;
    const header = ["id", "title", "artifact_key", "direct_status", ...BAR_BUCKETS].join("\t");
    const lines = sortedNodes.map((n) =>
      [
        n.id,
        n.title.replace(/\t/g, " "),
        n.artifact_key ?? "",
        n.direct_status,
        ...BAR_BUCKETS.map((b) => String(n.subtree_counts[b] ?? 0)),
      ].join("\t"),
    );
    const text = [header, ...lines].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showNotification(t("requirementCoverage.copied"), "success");
    } catch {
      showNotification(t("requirementCoverage.copyFailed"), "error");
    }
  }, [coverageQuery.data?.nodes, sortedNodes, showNotification, t]);

  const applyFilters = () => {
    const u = draftUnder.trim();
    const r = draftRun.trim();
    const s = draftSuite.trim();
    const c = draftCampaign.trim();
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (u && isUuid(u)) n.set("under", u);
      else n.delete("under");
      if (r && isUuid(r)) n.set("scopeRun", r);
      else n.delete("scopeRun");
      if (s && isUuid(s)) n.set("scopeSuite", s);
      else n.delete("scopeSuite");
      if (c && isUuid(c)) n.set("scopeCampaign", c);
      else n.delete("scopeCampaign");
      n.delete("refresh");
      if (!draftIncludeReverse) n.set("reverse", "0");
      else n.delete("reverse");
      return n;
    }, { replace: true });
    setDraftUnder(u);
    setDraftRun(r);
    setDraftSuite(s);
    setDraftCampaign(c);
  };

  const forceRefresh = () => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("refresh", "1");
      return n;
    }, { replace: true });
  };

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-6xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  const errDetail =
    coverageQuery.isError && coverageQuery.error && typeof coverageQuery.error === "object"
      ? (coverageQuery.error as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : null;

  return (
    <div className="mx-auto max-w-6xl min-h-0 px-4 py-6">
      <ProjectBreadcrumbs
        currentPageLabel={t("requirementCoverage.breadcrumb")}
        projectName={project?.name}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={orgSlug && projectSlug ? artifactsPath(orgSlug, projectSlug) : "#"}>
            {t("requirementCoverage.backArtifacts")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("requirementCoverage.title")}</CardTitle>
          <CardDescription>{t("requirementCoverage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("requirementCoverage.filtersUnder")}
              </label>
              <Input
                value={draftUnder}
                onChange={(e) => setDraftUnder(e.target.value)}
                placeholder={t("requirementCoverage.filtersUnderPlaceholder")}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("requirementCoverage.scopeRun")}
              </label>
              <Input
                value={draftRun}
                onChange={(e) => setDraftRun(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("requirementCoverage.scopeSuite")}
              </label>
              <Input
                value={draftSuite}
                onChange={(e) => setDraftSuite(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("requirementCoverage.scopeCampaign")}
              </label>
              <Input
                value={draftCampaign}
                onChange={(e) => setDraftCampaign(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("requirementCoverage.scopeHint")}</p>
          <div className="flex items-center gap-2">
            <Checkbox
              id="coverage-include-reverse"
              checked={draftIncludeReverse}
              onCheckedChange={(v) => setDraftIncludeReverse(v === true)}
            />
            <label htmlFor="coverage-include-reverse" className="text-sm leading-none">
              {t("requirementCoverage.includeReverseVerifies")}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={applyFilters}>
              {t("requirementCoverage.applyFilters")}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={forceRefresh}>
              {t("requirementCoverage.refresh")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyTsv()}>
              <ClipboardCopy className="mr-1 size-3.5" />
              {t("requirementCoverage.copyTsv")}
            </Button>
          </div>

          {coverageQuery.data ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("requirementCoverage.computedAt", {
                  iso: new Date(coverageQuery.data.computed_at).toLocaleString(),
                })}
              </span>
              {coverageQuery.data.cache_hit ? (
                <Badge variant="secondary">{t("requirementCoverage.cacheHit")}</Badge>
              ) : null}
            </div>
          ) : null}

          {coverageQuery.isPending ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {t("requirementCoverage.loading")}
            </div>
          ) : coverageQuery.isError ? (
            <p className="text-sm text-destructive">
              {t("requirementCoverage.error")}
              {errDetail ? `: ${errDetail}` : ""}
            </p>
          ) : !sortedNodes.length ? (
            <p className="text-sm text-muted-foreground">{t("requirementCoverage.empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2">{t("requirementCoverage.colName")}</th>
                    <th className="px-3 py-2 w-28">{t("requirementCoverage.colDirect")}</th>
                    <th className="px-3 py-2 min-w-[220px]">{t("requirementCoverage.colSubtree")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((node) => {
                    const d = depths.get(node.id) ?? 0;
                    const total = BAR_BUCKETS.reduce((s, b) => s + (node.subtree_counts[b] ?? 0), 0);
                    return (
                      <tr key={node.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div style={{ paddingLeft: d * 12 }} className="min-w-0">
                            <p className="truncate font-medium">{node.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {node.artifact_key ?? node.artifact_type}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Badge variant="outline" className="text-xs font-normal">
                            {statusLabel(node.direct_status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {total === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div
                              className="flex h-7 w-full min-w-[180px] overflow-hidden rounded-md bg-muted"
                              role="img"
                              aria-label="Subtree coverage by leaf status"
                            >
                              {BAR_BUCKETS.map((b) => {
                                const n = node.subtree_counts[b] ?? 0;
                                if (n <= 0) return null;
                                const pct = (n / total) * 100;
                                return (
                                  <button
                                    key={b}
                                    type="button"
                                    title={`${statusLabel(b)}: ${n}`}
                                    className={`${BUCKET_CLASS[b] ?? "bg-muted-foreground"} relative flex min-w-[2px] items-center justify-center text-[10px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                                    style={{ width: `${pct}%` }}
                                    onClick={() =>
                                      openSegment(node, b, coverageQuery.data?.leaves ?? [])
                                    }
                                  >
                                    {pct >= 12 ? n : ""}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("requirementCoverage.dialogTitle")}</DialogTitle>
            <DialogDescription className="sr-only">
              {dialog
                ? `${dialog.node.title} — ${statusLabel(dialog.bucket)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {dialog ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{statusLabel(dialog.bucket)}</Badge>
                <span className="text-muted-foreground">{dialog.node.title}</span>
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {dialog.leaves.map((leaf) => (
                  <li
                    key={leaf.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 font-medium">{leaf.title}</span>
                      {orgSlug && projectSlug ? (
                        <Button variant="link" size="sm" className="h-auto p-0" asChild>
                          <Link to={artifactDetailPath(orgSlug, projectSlug, leaf.id)}>
                            {t("requirementCoverage.goToArtifact")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    {leaf.tests.length > 0 ? (
                      <div className="mt-2 border-t pt-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {t("requirementCoverage.testsForLeaf")}
                        </p>
                        <ul className="space-y-1 text-xs">
                          {leaf.tests.map((tx) => (
                            <li key={tx.test_id} className="flex flex-wrap items-center gap-2">
                              <span className="text-muted-foreground">
                                {tx.status ? statusLabel(tx.status) : statusLabel("no_run")}
                              </span>
                              {orgSlug && projectSlug ? (
                                <>
                                  <Link
                                    to={qualityCatalogArtifactPath(orgSlug, projectSlug, tx.test_id)}
                                    className="text-primary underline-offset-4 hover:underline"
                                  >
                                    {t("requirementCoverage.goToTest")}
                                  </Link>
                                  {tx.run_id ? (
                                    <Link
                                      to={qualityPath(orgSlug, projectSlug, {
                                        artifact: tx.run_id,
                                        tree: "testsuites",
                                      })}
                                      className="text-primary underline-offset-4 hover:underline"
                                    >
                                      {t("requirementCoverage.goToRun")}
                                    </Link>
                                  ) : null}
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog(null)}>
                {t("requirementCoverage.dialogBack")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
