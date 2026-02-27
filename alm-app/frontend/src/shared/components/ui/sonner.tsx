import { Toaster as SonnerToaster } from "sonner";

function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        duration: 3000,
      }}
    />
  );
}

export { Toaster };
