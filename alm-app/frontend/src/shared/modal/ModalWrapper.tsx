import type { ReactNode } from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui";
import { cn } from "../components/ui/utils";
import { allowModalCloseAsync } from "./modalCloseGuard";

export type ModalOptions = {
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  destroyOnClose?: boolean;
  title?: string;
};

const maxWidthClass: Record<string, string> = {
  xs: "max-w-[444px]",
  sm: "max-w-[600px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
  xl: "max-w-[min(1600px,calc(100vw-2rem))] sm:max-w-[min(1600px,calc(100vw-2rem))]",
};

type ModalWrapperProps = {
  children: ReactNode;
  title?: string;
  options?: ModalOptions;
  onClose: () => void;
};

export function ModalWrapper({ children, title, options, onClose }: ModalWrapperProps) {
  const [open, setOpen] = useState(true);
  const maxWidth = options?.maxWidth ?? "sm";
  const className = maxWidthClass[maxWidth] ?? maxWidthClass.sm;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void (async () => {
            try {
              if (!(await allowModalCloseAsync())) {
                queueMicrotask(() => setOpen(true));
                return;
              }
              onClose();
            } catch {
              queueMicrotask(() => setOpen(true));
            }
          })();
        }
      }}
    >
      <DialogContent
        className={cn(className, "max-h-[calc(100vh-2rem)] flex flex-col gap-0 overflow-hidden")}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle id="modal-title">{title ?? "Modal"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100vh-7rem)] min-h-0 shrink overflow-y-auto overscroll-contain -mx-6 px-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
