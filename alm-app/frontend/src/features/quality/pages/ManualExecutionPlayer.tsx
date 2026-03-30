import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ManualExecutionPlayerCore } from "../components/ManualExecutionPlayerCore";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";

export default function ManualExecutionPlayer() {
  const { orgSlug, projectSlug: routeProjectSlug, runId } = useParams<{
    orgSlug: string;
    projectSlug: string;
    runId: string;
  }>();
  const [searchParams] = useSearchParams();
  const { project } = useArtifactsPageProject();
  const navigate = useNavigate();

  const layout = searchParams.get("popout") === "1" ? "popout" : "default";
  const deepLinkTestId = searchParams.get("test")?.trim() || undefined;
  const deepLinkStepId = searchParams.get("step")?.trim() || undefined;

  if (!orgSlug || !routeProjectSlug || !runId || !project?.id) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-12 text-center text-muted-foreground">
        Invalid execution context. Please return to the project and try again.
      </div>
    );
  }

  const handleExit = () => {
    if (layout === "popout") {
      window.close();
      // If the browser ignores close (tab not opened via window.open), stay useful in this window.
      window.setTimeout(() => {
        navigate(`/${orgSlug}/${routeProjectSlug}/quality`);
      }, 150);
      return;
    }
    navigate(`/${orgSlug}/${routeProjectSlug}/quality`);
  };

  return (
    <ManualExecutionPlayerCore
      key={`${orgSlug}:${project.id}:${runId}`}
      orgSlug={orgSlug}
      projectSlug={project.id}
      executePathProjectSlug={routeProjectSlug}
      runId={runId}
      onExit={handleExit}
      fullScreen={true}
      layout={layout}
      deepLinkTestId={deepLinkTestId}
      deepLinkStepId={deepLinkStepId}
    />
  );
}
