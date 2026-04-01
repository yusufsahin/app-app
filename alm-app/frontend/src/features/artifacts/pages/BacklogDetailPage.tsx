import { useParams } from "react-router-dom";
import BacklogWorkspacePage from "./BacklogWorkspacePage";

export default function BacklogDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();

  return <BacklogWorkspacePage variant="default" routeArtifactId={artifactId} detailMode="page" />;
}
