import { cn } from "../../../shared/components/ui";
import type { AiMessage } from "../types/ai";

interface Props {
  message: AiMessage;
}

export function AiMessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {message.content || "(empty)"}
      </div>
    </div>
  );
}
