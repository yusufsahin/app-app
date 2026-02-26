import { type ReactNode, useEffect, useRef } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider, useSnackbar } from "notistack";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { theme } from "./theme";
import { LayoutUIProvider } from "../shared/contexts/LayoutUIContext";
import { useNotificationStore } from "../shared/stores/notificationStore";

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

/** Bridges Zustand notification store to notistack (top-right, max 3, 3s). */
function NotistackBridge() {
  const notification = useNotificationStore((s) => s.notification);
  const clearNotification = useNotificationStore((s) => s.clearNotification);
  const { enqueueSnackbar } = useSnackbar();
  const prevRef = useRef<typeof notification>(null);

  useEffect(() => {
    if (!notification || notification === prevRef.current) return;
    prevRef.current = notification;
    enqueueSnackbar(notification.message, {
      variant: notification.severity,
      autoHideDuration: 3000,
    });
    clearNotification();
  }, [notification, enqueueSnackbar, clearNotification]);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <LayoutUIProvider>
            <SnackbarProvider
              maxSnack={3}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              autoHideDuration={3000}
            >
              {children}
              <NotistackBridge />
            </SnackbarProvider>
          </LayoutUIProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
