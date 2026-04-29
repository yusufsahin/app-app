import { useCallback } from "react";
import { useAiStore } from "../../../shared/stores/aiStore";
import { sendAiMessageStream, useCreateAiConversation, useSendAiMessage } from "../../../shared/api/aiApi";

export function useAiChat(orgSlug: string) {
  const conversationId = useAiStore((s) => s.conversationId);
  const setConversationId = useAiStore((s) => s.setConversationId);
  const appendMessage = useAiStore((s) => s.appendMessage);
  const addPendingAction = useAiStore((s) => s.addPendingAction);
  const autonomyLevel = useAiStore((s) => s.autonomyLevel);
  const setIsStreaming = useAiStore((s) => s.setIsStreaming);
  const createConversation = useCreateAiConversation(orgSlug);
  const sendMessageMutation = useSendAiMessage(orgSlug, conversationId);

  const sendMessage = useCallback(
    async (content: string, projectId?: string, artifactContextId?: string) => {
      if (!conversationId) {
        const created = await createConversation.mutateAsync({
          project_id: projectId,
          first_message: content,
          autonomy_level: autonomyLevel,
          artifact_context_id: artifactContextId,
        });
        setConversationId(created.conversation.id);
        appendMessage(created.assistant_message);
        created.pending_actions.forEach(addPendingAction);
        return created;
      }
      setIsStreaming(true);
      let result;
      try {
        result =
          autonomyLevel === "suggest"
            ? await sendAiMessageStream(orgSlug, conversationId, content)
            : await sendMessageMutation.mutateAsync(content);
      } finally {
        setIsStreaming(false);
      }
      appendMessage(result.assistant_message);
      result.pending_actions.forEach(addPendingAction);
      return result;
    },
    [
      addPendingAction,
      appendMessage,
      autonomyLevel,
      conversationId,
      createConversation,
      sendMessageMutation,
      setIsStreaming,
      setConversationId,
    ],
  );

  return {
    sendMessage,
    isLoading: createConversation.isPending || sendMessageMutation.isPending,
  };
}
