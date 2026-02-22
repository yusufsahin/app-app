import { create } from "zustand";

interface Notification {
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

interface NotificationState {
  notification: Notification | null;
  showNotification: (message: string, severity?: Notification["severity"]) => void;
  clearNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notification: null,

  showNotification: (message, severity = "success") =>
    set({ notification: { message, severity } }),

  clearNotification: () => set({ notification: null }),
}));
