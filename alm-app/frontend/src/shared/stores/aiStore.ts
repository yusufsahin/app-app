import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AiMessage, AiPendingAction, AutonomyLevel } from "../../features/aiAssistant/types/ai";

interface AiState {
  isOpen: boolean;
  conversationId: string | null;
  messages: AiMessage[];
  pendingActions: AiPendingAction[];
  isStreaming: boolean;
  autonomyLevel: AutonomyLevel;
  artifactContextId: string | null;
  openChat: (artifactContextId?: string) => void;
  closeChat: () => void;
  setConversationId: (id: string | null) => void;
  appendMessage: (msg: AiMessage) => void;
  setMessages: (messages: AiMessage[]) => void;
  addPendingAction: (action: AiPendingAction) => void;
  setPendingActions: (actions: AiPendingAction[]) => void;
  resolvePendingAction: (id: string, status: "approved" | "rejected" | "executed") => void;
  setIsStreaming: (value: boolean) => void;
  setAutonomyLevel: (level: AutonomyLevel) => void;
}

export const useAiStore = create<AiState>()(
  devtools(
    (set) => ({
      isOpen: false,
      conversationId: null,
      messages: [],
      pendingActions: [],
      isStreaming: false,
      autonomyLevel: "suggest",
      artifactContextId: null,
      openChat: (artifactContextId) =>
        set({ isOpen: true, artifactContextId: artifactContextId ?? null }),
      closeChat: () => set({ isOpen: false }),
      setConversationId: (id) => set({ conversationId: id }),
      appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setMessages: (messages) => set({ messages }),
      addPendingAction: (action) => set((s) => ({ pendingActions: [...s.pendingActions, action] })),
      setPendingActions: (actions) => set({ pendingActions: actions }),
      resolvePendingAction: (id, status) =>
        set((s) => ({
          pendingActions: s.pendingActions.map((a) => (a.id === id ? { ...a, status } : a)),
        })),
      setIsStreaming: (value) => set({ isStreaming: value }),
      setAutonomyLevel: (level) => set({ autonomyLevel: level }),
    }),
    { name: "AiStore", enabled: import.meta.env.DEV },
  ),
);
