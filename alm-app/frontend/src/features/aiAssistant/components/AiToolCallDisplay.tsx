import type { AiMessage } from "../types/ai";

interface Props {
  message: AiMessage;
}

export function AiToolCallDisplay({ message }: Props) {
  if (!message.tool_calls?.length && !message.tool_results?.length) return null;
  return (
    <div className="rounded-md border bg-background p-2 text-xs">
      {message.tool_calls?.length ? (
        <pre className="overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(message.tool_calls, null, 2)}
        </pre>
      ) : null}
      {message.tool_results?.length ? (
        <pre className="overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(message.tool_results, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
