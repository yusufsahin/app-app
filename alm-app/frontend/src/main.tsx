import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./app/providers";
import { App } from "./app/App";
import { useAuthStore } from "./shared/stores/authStore";
import { useTenantStore } from "./shared/stores/tenantStore";

useAuthStore.getState().initFromStorage();
useTenantStore.getState().initFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
