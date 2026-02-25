import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ModalType } from "./modalRegistry";
import type { ModalPropsMap, OpenModalOptions } from "./modalTypes";

type ModalState =
  | { isOpened: false; modalType: null; modalProps: null; titleOverride: null }
  | {
      isOpened: true;
      modalType: ModalType;
      modalProps: ModalPropsMap[ModalType];
      titleOverride: string | null;
    };

type ModalStore = ModalState & {
  openModal: <T extends ModalType>(
    type: T,
    props: ModalPropsMap[T],
    options?: OpenModalOptions,
  ) => void;
  closeModal: () => void;
  /** Update props for the currently open modal (e.g. when parent state changes). */
  updateModalProps: <T extends ModalType>(partial: Partial<ModalPropsMap[T]>) => void;
};

export const useModalStore = create<ModalStore>()(
  devtools(
    (set) => ({
      isOpened: false,
      modalType: null,
      modalProps: null,
      titleOverride: null,

      openModal: (type, props, options) =>
        set({
          isOpened: true,
          modalType: type,
          modalProps: props,
          titleOverride: options?.title ?? null,
        }),

      closeModal: () =>
        set((state) => {
          if (state.isOpened && state.modalProps) {
            const props = state.modalProps as { onCloseComplete?: () => void };
            props.onCloseComplete?.();
          }
          return {
            isOpened: false,
            modalType: null,
            modalProps: null,
            titleOverride: null,
          };
        }),

      updateModalProps: (partial) =>
        set((state) => {
          if (!state.isOpened || !state.modalType || !state.modalProps) return state;
          return {
            modalProps: { ...state.modalProps, ...partial } as ModalPropsMap[typeof state.modalType],
          };
        }),
    }),
    { name: "ModalStore", enabled: import.meta.env.DEV },
  ),
);
