import type { ComponentType } from "react";
import { Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { MODALS } from "./modalRegistry";
import { useModalStore } from "./useModalStore";
import { ModalWrapper } from "./ModalWrapper";

export function ModalManager() {
  const location = useLocation();
  const { isOpened, modalType, modalProps, titleOverride, closeModal } = useModalStore();

  useEffect(() => {
    closeModal();
  }, [location.key, closeModal]);

  if (!isOpened || !modalType) return null;

  const def = MODALS[modalType];
  const Cmp = def.component as unknown as ComponentType<
    Record<string, unknown> & { onClose: () => void }
  >;
  const options = def.options ?? {};
  const title = titleOverride ?? def.title ?? modalType;

  return (
    <ModalWrapper title={title} options={options} onClose={closeModal}>
      <Suspense
        fallback={
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        }
      >
        <Cmp {...(modalProps as object)} onClose={closeModal} />
      </Suspense>
    </ModalWrapper>
  );
}
