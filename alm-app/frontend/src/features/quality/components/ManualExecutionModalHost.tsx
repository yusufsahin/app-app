import { useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../../shared/components/ui/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../shared/components/ui/dialog";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { ManualExecutionPlayerCore } from "./ManualExecutionPlayerCore";
import { isArtifactUuid } from "../lib/qualityRunPaths";

/**
 * Full manual runner as an in-app modal. Opened when URL search contains `runExecute=<run artifact id>`
 * (optional `runTest`, `runStep` for deep links). Mount under AppLayout for any project route.
 */
export function ManualExecutionModalHost() {
  const { t } = useTranslation("quality");
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project } = useArtifactsPageProject();

  const runExecute = searchParams.get("runExecute")?.trim() ?? "";
  const runTest = searchParams.get("runTest")?.trim() || undefined;
  const runStep = searchParams.get("runStep")?.trim() || undefined;

  const open = Boolean(
    orgSlug &&
      projectSlug &&
      project?.id &&
      runExecute &&
      isArtifactUuid(runExecute),
  );

  const stripExecutionParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("runExecute");
        n.delete("runTest");
        n.delete("runStep");
        return n;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useEffect(() => {
    if (runExecute && !isArtifactUuid(runExecute)) {
      stripExecutionParams();
    }
  }, [runExecute, stripExecutionParams]);

  const handleExit = useCallback(() => {
    stripExecutionParams();
  }, [stripExecutionParams]);

  const modalKey = useMemo(
    () => (open ? `${orgSlug}:${project!.id}:${runExecute}:${runTest ?? ""}:${runStep ?? ""}` : "closed"),
    [open, orgSlug, project, runExecute, runTest, runStep],
  );

  if (!orgSlug || !projectSlug) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) stripExecutionParams();
      }}
    >
      <DialogContent
        data-testid="quality-manual-execution-modal"
        className={cn(
          "flex h-[min(90dvh,920px)] w-[min(96vw,1200px)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden border-0 p-0 sm:max-w-none",
          "[&>button]:hidden",
        )}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t("execution.modalTitle")}</DialogTitle>
        {open && project?.id ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <ManualExecutionPlayerCore
              key={modalKey}
              orgSlug={orgSlug}
              projectSlug={project.id}
              executePathProjectSlug={projectSlug}
              runId={runExecute}
              onExit={handleExit}
              fullScreen={false}
              layout="default"
              deepLinkTestId={runTest}
              deepLinkStepId={runStep}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
