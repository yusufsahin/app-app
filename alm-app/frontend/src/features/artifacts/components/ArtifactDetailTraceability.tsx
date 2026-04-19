import { useTranslation } from "react-i18next";
import type { Task } from "../../../shared/api/taskApi";
import { ArtifactDetailDeployments } from "./ArtifactDetailDeployments";
import { ArtifactDetailSource } from "./ArtifactDetailSource";

export interface ArtifactDetailTraceabilityProps {
  orgSlug: string | undefined;
  projectSlug: string | undefined;
  projectId: string | undefined;
  artifactId: string | undefined;
  artifactKey?: string | null;
  tasks: Task[];
  canEdit: boolean;
  taskScopeId?: string | null;
}

/**
 * Single scroll view combining SCM source links and deployment traceability (S4 + SCM),
 * without changing the underlying tab panels.
 */
export function ArtifactDetailTraceability({
  orgSlug,
  projectSlug,
  projectId,
  artifactId,
  artifactKey,
  tasks,
  canEdit,
  taskScopeId,
}: ArtifactDetailTraceabilityProps) {
  const { t } = useTranslation("quality");

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{t("workItemDetail.traceability.intro")}</p>
      <section className="space-y-3" aria-labelledby="artifact-traceability-source-heading">
        <h3 id="artifact-traceability-source-heading" className="text-sm font-medium">
          {t("workItemDetail.traceability.sourceHeading")}
        </h3>
        <ArtifactDetailSource
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          projectId={projectId}
          artifactId={artifactId}
          artifactKey={artifactKey}
          tasks={tasks}
          canEdit={canEdit}
          taskScopeId={taskScopeId}
        />
      </section>
      <section className="space-y-3 border-t border-border pt-6" aria-labelledby="artifact-traceability-deploy-heading">
        <h3 id="artifact-traceability-deploy-heading" className="text-sm font-medium">
          {t("workItemDetail.traceability.deployHeading")}
        </h3>
        <ArtifactDetailDeployments
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          projectId={projectId}
          artifactId={artifactId ?? ""}
        />
      </section>
    </div>
  );
}
