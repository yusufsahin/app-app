import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../shared/components/ui";
import { useResolvePendingAction } from "../../../shared/api/aiApi";
import { useAiStore } from "../../../shared/stores/aiStore";
import { useAiChat } from "../hooks/useAiChat";
import { AiMessageBubble } from "./AiMessageBubble";
import { AiPendingActions } from "./AiPendingActions";
import { AiToolCallDisplay } from "./AiToolCallDisplay";

export function AiChatPanel() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const isOpen = useAiStore((s) => s.isOpen);
  const closeChat = useAiStore((s) => s.closeChat);
  const messages = useAiStore((s) => s.messages);
  const pendingActions = useAiStore((s) => s.pendingActions);
  const autonomyLevel = useAiStore((s) => s.autonomyLevel);
  const setAutonomyLevel = useAiStore((s) => s.setAutonomyLevel);
  const { sendMessage, isLoading } = useAiChat(orgSlug ?? "");
  const approveMutation = useResolvePendingAction(orgSlug ?? "", true);
  const rejectMutation = useResolvePendingAction(orgSlug ?? "", false);
  const [content, setContent] = useState("");

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    setContent("");
    await sendMessage(text);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeChat()}>
      <SheetContent side="right" className="flex h-full w-full max-w-[520px] flex-col gap-0 p-0">
        <SheetTitle className="sr-only">AI Assistant</SheetTitle>
        <SheetDescription className="sr-only">
          Chat with the ALM AI assistant and review pending actions.
        </SheetDescription>

        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">AI Assistant</h3>
          <Select
            value={autonomyLevel}
            onValueChange={(value) => setAutonomyLevel(value as "suggest" | "confirm" | "auto")}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Autonomy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suggest">Suggest</SelectItem>
              <SelectItem value="confirm">Confirm</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <AiMessageBubble message={message} />
              <AiToolCallDisplay message={message} />
            </div>
          ))}
          <AiPendingActions
            pendingActions={pendingActions}
            onApprove={async (id) => {
              await approveMutation.mutateAsync(id);
            }}
            onReject={async (id) => {
              await rejectMutation.mutateAsync(id);
            }}
          />
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ask AI assistant..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <Button onClick={() => void submit()} disabled={isLoading || !content.trim()}>
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
