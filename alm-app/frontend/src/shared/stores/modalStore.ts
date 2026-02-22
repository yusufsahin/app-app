import { type ComponentType, type ReactNode } from "react";
import { create } from "zustand";

interface ModalEntry {
  id: string;
  component: ComponentType<Record<string, unknown>>;
  props: Record<string, unknown>;
  options: {
    size?: "sm" | "md" | "lg" | "xl";
    closable?: boolean;
  };
}

interface ModalState {
  stack: ModalEntry[];
  open: (
    id: string,
    component: ComponentType<Record<string, unknown>>,
    props?: Record<string, unknown>,
    options?: ModalEntry["options"],
  ) => void;
  close: (id?: string) => void;
  closeAll: () => void;
  update: (id: string, props: Record<string, unknown>) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  stack: [],

  open: (id, component, props = {}, options = {}) =>
    set((state) => ({
      stack: [...state.stack, { id, component, props, options }],
    })),

  close: (id) =>
    set((state) => ({
      stack: id ? state.stack.filter((m) => m.id !== id) : state.stack.slice(0, -1),
    })),

  closeAll: () => set({ stack: [] }),

  update: (id, props) =>
    set((state) => ({
      stack: state.stack.map((m) => (m.id === id ? { ...m, props: { ...m.props, ...props } } : m)),
    })),
}));
