import { TabsContent } from "../../../shared/components/ui";
import { ArtifactCommentsPanel } from "../../../shared/components/comments";
import type { TenantMember } from "../../../shared/api/orgApi";

interface ArtifactDetailCommentsProps {
  orgSlug: string | undefined;
  projectId: string | undefined;
  artifactId: string | undefined;
  members?: TenantMember[] | null;
  canComment: boolean;
}

export function ArtifactDetailComments({
  orgSlug,
  projectId,
  artifactId,
  members,
  canComment,
}: ArtifactDetailCommentsProps) {
  return (
    <TabsContent value="comments" className="py-2">
      <ArtifactCommentsPanel
        orgSlug={orgSlug}
        projectId={projectId}
        artifactId={artifactId}
        members={members ?? undefined}
        canComment={canComment}
      />
    </TabsContent>
  );
}
