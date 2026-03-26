import { useNavigate, useParams } from "react-router-dom";
import { ManualExecutionPlayerCore } from "../components/ManualExecutionPlayerCore";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";

export default function ManualExecutionPlayer() {
  const { orgSlug, projectSlug, runId } = useParams<{
    orgSlug: string;
    projectSlug: string;
    runId: string;
  }>();
  const { project } = useArtifactsPageProject();
  const navigate = useNavigate();

  if (!orgSlug || !projectSlug || !runId || !project?.id) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-12 text-center text-muted-foreground">
        Invalid execution context. Please return to the project and try again.
      </div>
    );
  }

  const handleExit = () => {
    navigate(`/${orgSlug}/${projectSlug}/quality`);
  };

  return (
    <ManualExecutionPlayerCore
      orgSlug={orgSlug}
      projectSlug={project.id}
      runId={runId}
      onExit={handleExit}
      fullScreen={true}
    />
  );
}
