import type { ReactNode } from "react";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Paper,
} from "@mui/material";
import { Close } from "@mui/icons-material";

export type ModalOptions = {
  maxWidth?: "xs" | "sm" | "md" | "lg";
  destroyOnClose?: boolean;
  title?: string;
};

const maxWidthToPx: Record<string, number> = {
  xs: 444,
  sm: 600,
  md: 900,
  lg: 1200,
};

type ModalWrapperProps = {
  children: ReactNode;
  title?: string;
  options?: ModalOptions;
  onClose: () => void;
};

export function ModalWrapper({ children, title, options, onClose }: ModalWrapperProps) {
  const maxWidth = options?.maxWidth ?? "sm";
  const widthPx = maxWidthToPx[maxWidth] ?? 600;
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleClose]);

  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    const prevScroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    cardRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = prevScroll;
      previousActive?.focus();
    };
  }, []);

  const overlay = (
    <Modal
      open
      onClose={handleClose}
      aria-labelledby="modal-title"
      aria-modal="true"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Box
        sx={{
          maxHeight: "calc(100vh - 2rem)",
          width: "100%",
          outline: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Paper
          ref={cardRef}
          tabIndex={-1}
          elevation={24}
          sx={{
            width: "100%",
            maxWidth: widthPx,
            maxHeight: "calc(100vh - 2rem)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <Typography id="modal-title" variant="h6" component="h2" fontWeight={600} sx={{ pr: 1 }}>
              {title ?? "Modal"}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              aria-label="Close"
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
          <Box
            sx={{
              overflowY: "auto",
              flex: 1,
              minHeight: 0,
              p: 2,
            }}
          >
            {children}
          </Box>
        </Paper>
      </Box>
    </Modal>
  );

  return createPortal(overlay, document.body);
}
