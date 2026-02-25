import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface Notification {
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

interface NotificationState {
  notification: Notification | null;
  showNotification: (message: string, severity?: Notification["severity"]) => void;
  clearNotification: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      notification: null,

      showNotification: (message, severity = "success") =>
        set({ notification: { message, severity } }),

      clearNotification: () => set({ notification: null }),
    }),
    { name: "NotificationStore", enabled: import.meta.env.DEV },
  ),
);
