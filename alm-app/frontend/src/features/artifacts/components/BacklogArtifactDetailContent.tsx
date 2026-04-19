import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, PlayCircle } from "lucide-react";
import { Badge, Button, Skeleton, Tabs, TabsList, TabsTrigger } from "../../../shared/components/ui";
import { qualityRunExecutePath } from "../../quality/lib/qualityRunPaths";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { Task } from "../../../shared/api/taskApi";
import type { Attachment } from "../../../shared/api/attachmentApi";
import type { ArtifactRelationship } from "../../../shared/api/relationshipApi";
import type { Cadence, AreaNode } from "../../../shared/api/planningApi";
import type { EntityHistoryResponse } from "../../../shared/api/auditApi";
import type { TenantMember } from "../../../shared/api/orgApi";
import { ArtifactDetailAttachments } from "./ArtifactDetailAttachments";
import { ArtifactDetailAudit } from "./ArtifactDetailAudit";
import { ArtifactDetailComments } from "./ArtifactDetailComments";
import { ArtifactDetailDetails } from "./ArtifactDetailDetails";
import { ArtifactDetailHeader } from "./ArtifactDetailHeader";
import { ArtifactDetailImpactAnalysis } from "./ArtifactDetailImpactAnalysis";
import { ArtifactDetailLinks } from "./ArtifactDetailLinks";
import { ArtifactDetailTasks } from "./ArtifactDetailTasks";
import { ArtifactDetailDeployments } from "./ArtifactDetailDeployments";
import { ArtifactDetailSource } from "./ArtifactDetailSource";
import { ArtifactDetailTraceability } from "./ArtifactDetailTraceability";
import type { ArtifactImpactAnalysisResponse } from "../../../shared/api/relationshipApi";

export type BacklogDetailTab =
  | "details"
  | "tasks"
  | "links"
  | "source"
  | "traceability"
  | "deploy"
  | "impact"
  | "attachments"
  | "comments"
  | "audit";

interface TagOption {
  id: string;
  name: string;
}

interface BacklogArtifactDetailContentProps {
  detailArtifact: Artifact | null;
  detailLoading: boolean;
  detailTab: BacklogDetailTab;
  setDetailTab: (tab: BacklogDetailTab) => void;
  auditTarget: string;
  setAuditTarget: (target: string) => void;
  canCommentArtifact: boolean;
  canEditArtifact: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCopyLink: () => void;
  onEdit: () => void;
  onClose: () => void;
  orgSlug?: string;
  projectId?: string;
  projectSlug?: string;
  members?: TenantMember[] | null;
  cadencesFlat: Cadence[];
  cycleCadences: Cadence[];
  areaNodesFlat: AreaNode[];
  projectTags: TagOption[];
  recentlyUpdatedArtifactIds: Record<string, number | undefined>;
  presenceByArtifactId: Record<string, string[] | undefined>;
  formatDateTime: (value: string) => string;
  onOpenTransitionDialog: (artifact: Artifact, targetState: string) => void;
  getValidTransitions: (artifactType: string, state: string) => string[];
  tasks: Task[];
  tasksLoading: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddTask: () => void;
  /** When set (e.g. tree task click), Tasks list scrolls/highlights this task id for the open artifact. */
  highlightedDetailTaskId?: string | null;
  /** Persist task order after drag-reorder in the Tasks tab. */
  onReorderTasksCommitted?: (orderedTaskIds: string[]) => void;
  taskReorderPending?: boolean;
  artifactLinks: ArtifactRelationship[];
  linksLoading: boolean;
  impactAnalysis: ArtifactImpactAnalysisResponse | undefined;
  impactAnalysisLoading: boolean;
  impactDepth: number;
  impactRelationshipTypes: string[];
  impactTypeOptions: Array<{ value: string; label: string }>;
  onImpactDepthChange: (depth: number) => void;
  onImpactToggleRelationshipType: (relationshipType: string, checked: boolean) => void;
  onRefreshImpactAnalysis: () => void;
  commentsCount: number;
  scmLinksCount: number;
  onOpenLinkedArtifact: (artifactId: string) => void;
  onRemoveLink: (link: ArtifactRelationship) => void;
  onAddLink: () => void;
  attachments: Attachment[];
  attachmentsLoading: boolean;
  onDownloadAttachment: (attachment: Attachment) => Promise<void>;
  onDeleteAttachment: (attachment: Attachment) => void;
  onUploadAttachments: (files: File[]) => void;
  onRejectedAttachmentFiles?: (files: File[]) => void;
  onDuplicateAttachmentFiles?: (files: File[]) => void;
  onAttachmentCaptureResult?: (result: "added" | "failed" | "unsupported") => void;
  entityHistoryLoading: boolean;
  entityHistoryError: boolean;
  entityHistory: EntityHistoryResponse | undefined;
  onClearStaleTraceability?: () => void;
  clearStaleTraceabilityPending?: boolean;
}

export function BacklogArtifactDetailContent({
  detailArtifact,
  detailLoading,
  detailTab,
  setDetailTab,
  auditTarget,
  setAuditTarget,
  canCommentArtifact,
  canEditArtifact,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onCopyLink,
  onEdit,
  onClose,
  orgSlug,
  projectId,
  projectSlug,
  members,
  cadencesFlat,
  areaNodesFlat,
  recentlyUpdatedArtifactIds,
  presenceByArtifactId,
  formatDateTime,
  onOpenTransitionDialog,
  getValidTransitions,
  tasks,
  tasksLoading,
  onEditTask,
  onDeleteTask,
  onAddTask,
  highlightedDetailTaskId = null,
  onReorderTasksCommitted,
  taskReorderPending = false,
  artifactLinks,
  linksLoading,
  impactAnalysis,
  impactAnalysisLoading,
  impactDepth,
  impactRelationshipTypes,
  impactTypeOptions,
  onImpactDepthChange,
  onImpactToggleRelationshipType,
  onRefreshImpactAnalysis,
  commentsCount,
  scmLinksCount,
  onOpenLinkedArtifact,
  onRemoveLink,
  onAddLink,
  attachments,
  attachmentsLoading,
  onDownloadAttachment,
  onDeleteAttachment,
  onUploadAttachments,
  onRejectedAttachmentFiles,
  onDuplicateAttachmentFiles,
  onAttachmentCaptureResult,
  entityHistoryLoading,
  entityHistoryError,
  entityHistory,
  onClearStaleTraceability,
  clearStaleTraceabilityPending = false,
}: BacklogArtifactDetailContentProps) {
  const { t } = useTranslation("quality");

  return (
    <>
      <ArtifactDetailHeader
        hasArtifact={!!detailArtifact}
        isLoading={detailLoading}
        isEditing={false}
        canEdit={canEditArtifact}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={onPrev}
        onNext={onNext}
        onCopyLink={onCopyLink}
        onEdit={onEdit}
        onClose={onClose}
      />
      {detailLoading && (
        <div className="py-4">
          <Skeleton className="mb-2 h-6 w-[60%]" />
          <Skeleton className="mb-4 h-8 w-[90%]" />
          <Skeleton className="h-20 rounded-md" />
        </div>
      )}
      {detailArtifact && !detailLoading && (
        <>
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {detailArtifact.artifact_key ?? detailArtifact.id}
          </p>
          <div>
              <h3 className="mb-2 mt-1 text-lg font-semibold">{detailArtifact.title}</h3>
              {detailArtifact.stale_traceability ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm">
                  <AlertTriangle className="size-4 shrink-0 text-amber-800 dark:text-amber-400" aria-hidden />
                  <p className="min-w-0 flex-1 text-muted-foreground">{t("staleTraceability.banner")}</p>
                  {canEditArtifact && onClearStaleTraceability ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={clearStaleTraceabilityPending}
                      onClick={onClearStaleTraceability}
                    >
                      {t("staleTraceability.clearAction")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {(detailArtifact.tags?.length ?? 0) > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {detailArtifact.tags!.map((t) => (
                    <Badge key={t.id} variant="secondary" className="text-xs font-normal">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              )}
              {(recentlyUpdatedArtifactIds[detailArtifact.id] ||
                (presenceByArtifactId[detailArtifact.id]?.length ?? 0) > 0) && (
                <div className="mb-2 flex items-center gap-2">
                  {recentlyUpdatedArtifactIds[detailArtifact.id] && (
                    <Badge variant="secondary" className="text-xs">
                      Live update
                    </Badge>
                  )}
                  {(presenceByArtifactId[detailArtifact.id]?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {presenceByArtifactId[detailArtifact.id]!.length} active viewer
                      {presenceByArtifactId[detailArtifact.id]!.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              )}
              <p className="mb-2 text-sm text-muted-foreground">
                Type: {detailArtifact.artifact_type} · State: {detailArtifact.state}
              </p>
              {(detailArtifact.created_at || detailArtifact.updated_at) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  {detailArtifact.created_at && <>Created: {formatDateTime(detailArtifact.created_at)}</>}
                  {detailArtifact.created_at && detailArtifact.updated_at && " · "}
                  {detailArtifact.updated_at && <>Updated: {formatDateTime(detailArtifact.updated_at)}</>}
                </p>
              )}
              {detailArtifact.assignee_id && (
                <p className="mb-2 text-sm">
                  <strong>Assignee:</strong>{" "}
                  {members?.find((m) => m.user_id === detailArtifact.assignee_id)?.display_name ||
                    members?.find((m) => m.user_id === detailArtifact.assignee_id)?.email ||
                    detailArtifact.assignee_id}
                </p>
              )}
              {detailArtifact.artifact_type === "test-run" && orgSlug && projectSlug ? (
                <div className="mb-4 mt-3">
                  <Button size="sm" className="bg-blue-600 shadow-sm hover:bg-blue-700" asChild>
                    <Link to={qualityRunExecutePath(orgSlug, projectSlug, detailArtifact.id)}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Execute Run
                    </Link>
                  </Button>
                </div>
              ) : null}
              {detailArtifact.allowed_actions?.includes("transition") &&
                getValidTransitions(detailArtifact.artifact_type, detailArtifact.state).length > 0 && (
                  <div className="mb-4 mt-3">
                    <div className="flex flex-wrap gap-2">
                      {getValidTransitions(detailArtifact.artifact_type, detailArtifact.state).map((targetState) => (
                        <Button
                          key={targetState}
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenTransitionDialog(detailArtifact, targetState)}
                        >
                          Move to {targetState}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as BacklogDetailTab)} className="mb-2 min-h-[40px]">
                <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:thin]">
                  <TabsList className="inline-flex h-auto min-w-min w-max max-w-none flex-nowrap justify-start gap-0.5 bg-muted/80 p-1">
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="details">
                      Details
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="tasks">
                      Tasks ({tasks.length})
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="links">
                      Links ({artifactLinks.length})
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="source">
                      {t("workItemDetail.tabs.source", { count: scmLinksCount })}
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="traceability">
                      {t("workItemDetail.tabs.traceability")}
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="deploy">
                      {t("workItemDetail.tabs.deploy")}
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="impact">
                      Impact
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="attachments">
                      Attachments ({attachments.length})
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="comments">
                      Comments ({commentsCount})
                    </TabsTrigger>
                    <TabsTrigger className="shrink-0 flex-none px-2.5" value="audit">
                      Audit
                    </TabsTrigger>
                  </TabsList>
                </div>
                <ArtifactDetailDetails artifact={detailArtifact} cadencesFlat={cadencesFlat} areaNodesFlat={areaNodesFlat} />
                {detailTab === "tasks" && (
                  <ArtifactDetailTasks
                    tasks={tasks}
                    tasksLoading={tasksLoading}
                    members={members}
                    highlightedTaskId={highlightedDetailTaskId}
                    onEditTask={onEditTask}
                    onDeleteTask={onDeleteTask}
                    onAddTask={onAddTask}
                    onReorderTasksCommitted={onReorderTasksCommitted}
                    taskReorderPending={taskReorderPending}
                  />
                )}
                {detailTab === "links" && orgSlug && projectSlug && (
                  <ArtifactDetailLinks
                    links={artifactLinks}
                    linksLoading={linksLoading}
                    buildArtifactPath={(artifactId) => artifactDetailPath(orgSlug, projectSlug, artifactId)}
                    onOpenArtifact={onOpenLinkedArtifact}
                    onRemoveLink={onRemoveLink}
                    onAddLink={onAddLink}
                  />
                )}
                {detailTab === "source" && (
                  <ArtifactDetailSource
                    orgSlug={orgSlug}
                    projectSlug={projectSlug}
                    projectId={projectId}
                    artifactId={detailArtifact.id}
                    artifactKey={detailArtifact.artifact_key}
                    tasks={tasks}
                    canEdit={canEditArtifact}
                    taskScopeId={highlightedDetailTaskId}
                  />
                )}
                {detailTab === "traceability" && (
                  <ArtifactDetailTraceability
                    orgSlug={orgSlug}
                    projectSlug={projectSlug}
                    projectId={projectId}
                    artifactId={detailArtifact.id}
                    artifactKey={detailArtifact.artifact_key}
                    tasks={tasks}
                    canEdit={canEditArtifact}
                    taskScopeId={highlightedDetailTaskId}
                  />
                )}
                {detailTab === "deploy" && (
                  <ArtifactDetailDeployments
                    orgSlug={orgSlug}
                    projectSlug={projectSlug}
                    projectId={projectId}
                    artifactId={detailArtifact.id}
                  />
                )}
                {detailTab === "impact" && (
                  <ArtifactDetailImpactAnalysis
                    analysis={impactAnalysis}
                    isLoading={impactAnalysisLoading}
                    selectedRelationshipTypes={impactRelationshipTypes}
                    relationshipTypeOptions={impactTypeOptions}
                    depth={impactDepth}
                    onDepthChange={onImpactDepthChange}
                    onToggleRelationshipType={onImpactToggleRelationshipType}
                    onRefresh={onRefreshImpactAnalysis}
                    onOpenArtifact={onOpenLinkedArtifact}
                  />
                )}
                {detailTab === "attachments" && (
                  <ArtifactDetailAttachments
                    attachments={attachments}
                    attachmentsLoading={attachmentsLoading}
                    onDownload={onDownloadAttachment}
                    onDelete={onDeleteAttachment}
                    onUpload={onUploadAttachments}
                    onRejectedFiles={onRejectedAttachmentFiles}
                    onDuplicateFiles={onDuplicateAttachmentFiles}
                    onCaptureResult={onAttachmentCaptureResult}
                  />
                )}
                {detailTab === "comments" && (
                  <ArtifactDetailComments
                    orgSlug={orgSlug}
                    projectId={projectId}
                    artifactId={detailArtifact.id}
                    members={members}
                    canComment={canCommentArtifact}
                  />
                )}
                {detailTab === "audit" && (
                  <ArtifactDetailAudit
                    auditTarget={auditTarget}
                    onAuditTargetChange={setAuditTarget}
                    artifactLabel={detailArtifact.artifact_key ?? detailArtifact.id.slice(0, 8)}
                    tasks={tasks.map((task) => ({ id: task.id, title: task.title }))}
                    entityHistoryLoading={entityHistoryLoading}
                    entityHistoryError={entityHistoryError}
                    entityHistory={entityHistory}
                  />
                )}
              </Tabs>
            </div>
        </>
      )}
    </>
  );
}
