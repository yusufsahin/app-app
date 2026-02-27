import { type ReactNode, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { LayoutUIProvider } from "../shared/contexts/LayoutUIContext";
import { useNotificationStore } from "../shared/stores/notificationStore";
import { Toaster } from "../shared/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

/** Bridges Zustand notification store to Sonner (top-right, 3s). */
function ToastBridge() {
  const notification = useNotificationStore((s) => s.notification);
  const clearNotification = useNotificationStore((s) => s.clearNotification);
  const prevRef = useRef<typeof notification>(null);

  useEffect(() => {
    if (!notification || notification === prevRef.current) return;
    prevRef.current = notification;
    const fn =
      notification.severity === "error"
        ? toast.error
        : notification.severity === "warning"
          ? toast.warning
          : notification.severity === "info"
            ? toast.info
            : toast.success;
    fn(notification.message, { duration: 3000 });
    clearNotification();
  }, [notification, clearNotification]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LayoutUIProvider>
          {children}
          <ToastBridge />
          <Toaster />
        </LayoutUIProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
