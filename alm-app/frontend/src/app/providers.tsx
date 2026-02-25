import { type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Snackbar, Alert } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { theme } from "./theme";
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

function GlobalSnackbar() {
  const notification = useNotificationStore((s) => s.notification);
  const clearNotification = useNotificationStore((s) => s.clearNotification);

  return (
    <Snackbar
      open={!!notification}
      autoHideDuration={4000}
      onClose={clearNotification}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      {notification ? (
        <Alert
          onClose={clearNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {children}
          <GlobalSnackbar />
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
