import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui";
import { cn } from "../components/ui/utils";

export type ModalOptions = {
  maxWidth?: "xs" | "sm" | "md" | "lg";
  destroyOnClose?: boolean;
  title?: string;
};

const maxWidthClass: Record<string, string> = {
  xs: "max-w-[444px]",
  sm: "max-w-[600px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
};

type ModalWrapperProps = {
  children: ReactNode;
  title?: string;
  options?: ModalOptions;
  onClose: () => void;
};

export function ModalWrapper({ children, title, options, onClose }: ModalWrapperProps) {
  const maxWidth = options?.maxWidth ?? "sm";
  const className = maxWidthClass[maxWidth] ?? maxWidthClass.sm;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(className, "max-h-[calc(100vh-2rem)] flex flex-col")}
        onPointerDownOutside={onClose}
        onEscapeKeyDown={onClose}
      >
        <DialogHeader>
          <DialogTitle id="modal-title">{title ?? "Modal"}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
