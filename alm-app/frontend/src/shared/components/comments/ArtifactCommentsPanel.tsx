import { useForm, FormProvider } from "react-hook-form";
import { Button, Skeleton } from "../ui";
import { RhfTextField } from "../forms";
import { useCommentsByArtifact, useCreateComment } from "../../api/commentApi";
import type { TenantMember } from "../../api/orgApi";
import type { ProblemDetail } from "../../api/types";
import { useNotificationStore } from "../../stores/notificationStore";
import { formatDateTime } from "../../utils/formatDateTime";

export type ArtifactCommentsPanelLabels = {
  heading: string;
  placeholder: string;
  submit: string;
  emptyList: string;
  unknownAuthor: string;
  added: string;
  failed: string;
};

const DEFAULT_LABELS: ArtifactCommentsPanelLabels = {
  heading: "Comments",
  placeholder: "Add a comment...",
  submit: "Add comment",
  emptyList: "No comments yet.",
  unknownAuthor: "Unknown",
  added: "Comment added",
  failed: "Failed to add comment",
};

type CommentFormValues = { body: string };

function memberLabel(
  members: TenantMember[] | undefined,
  userId: string | null,
  unknownAuthor: string,
): string {
  if (!userId) return unknownAuthor;
  const m = members?.find((x) => x.user_id === userId);
  return m?.display_name || m?.email || userId;
}

export type ArtifactCommentsPanelProps = {
  orgSlug: string | undefined;
  projectId: string | undefined;
  artifactId: string | undefined;
  members: TenantMember[] | undefined;
  canComment: boolean;
  labels?: Partial<ArtifactCommentsPanelLabels>;
};

export function ArtifactCommentsPanel({
  orgSlug,
  projectId,
  artifactId,
  members,
  canComment,
  labels: labelsProp,
}: ArtifactCommentsPanelProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const showNotification = useNotificationStore((s) => s.showNotification);

  const { data: comments = [], isLoading: commentsLoading } = useCommentsByArtifact(
    orgSlug,
    projectId,
    artifactId,
  );
  const createCommentMutation = useCreateComment(orgSlug, projectId, artifactId);

  const commentForm = useForm<CommentFormValues>({ defaultValues: { body: "" } });
  const commentBody = commentForm.watch("body");

  if (!orgSlug || !projectId || !artifactId) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{labels.heading}</p>
      {commentsLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.emptyList}</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="flex flex-col gap-0.5 py-1">
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {memberLabel(members, c.created_by, labels.unknownAuthor)} ·{" "}
                    {formatDateTime(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canComment ? (
            <div className="mt-2 flex flex-col gap-2">
              <FormProvider {...commentForm}>
                <form
                  className="flex flex-col gap-2"
                  onSubmit={commentForm.handleSubmit((data) => {
                    const body = data.body.trim();
                    if (!body) return;
                    createCommentMutation.mutate(
                      { body },
                      {
                        onSuccess: () => {
                          commentForm.reset({ body: "" });
                          showNotification(labels.added, "success");
                        },
                        onError: (err: Error) => {
                          const b = (err as unknown as { body?: ProblemDetail })?.body;
                          showNotification(b?.detail ?? labels.failed, "error");
                        },
                      },
                    );
                  })}
                >
                  <RhfTextField<CommentFormValues> name="body" label="" placeholder={labels.placeholder} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!commentBody?.trim() || createCommentMutation.isPending}
                  >
                    {labels.submit}
                  </Button>
                </form>
              </FormProvider>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
