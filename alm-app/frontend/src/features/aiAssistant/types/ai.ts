export type AutonomyLevel = "suggest" | "confirm" | "auto";

export interface AiConversation {
  id: string;
  project_id: string | null;
  provider_config_id: string;
  autonomy_level: AutonomyLevel;
  title: string;
  artifact_context_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<Record<string, unknown>> | null;
  tool_results?: Array<Record<string, unknown>> | null;
  created_at: string | null;
}

export interface AiPendingAction {
  id: string;
  conversation_id: string;
  message_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "executed";
  executed_result?: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AgentTurnResponse {
  conversation: AiConversation;
  assistant_message: AiMessage;
  pending_actions: AiPendingAction[];
}
