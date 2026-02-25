import { create } from "zustand";

/**
 * Manifest context (project scope) — backend manifest_bundle is fetched per project.
 */
export interface ManifestContext {
  projectId: string;
  versionId: string;
  manifestBundle?: Record<string, unknown>;
}

export type ManifestEditorTab = "overview" | "preview" | "source" | "workflow";
export type ManifestSourceLanguage = "json" | "yaml";

interface ManifestState {
  // Context (optional, for future use)
  currentManifest: ManifestContext | null;
  setCurrentManifest: (manifest: ManifestContext | null) => void;
  clearManifest: () => void;

  // Editor UI state (Zustand standard)
  activeTab: ManifestEditorTab;
  sourceValue: string;
  sourceLanguage: ManifestSourceLanguage;
  snackMessage: string | null;
  snackOpen: boolean;

  setActiveTab: (tab: ManifestEditorTab) => void;
  setSourceValue: (value: string) => void;
  setSourceLanguage: (lang: ManifestSourceLanguage) => void;
  setSnackMessage: (message: string | null) => void;
  setSnackOpen: (open: boolean) => void;
  showSnack: (message: string) => void;

  /** Reset editor from loaded manifest_bundle (e.g. after fetch). */
  resetEditorFromBundle: (manifestBundle: Record<string, unknown> | null | undefined) => void;
  clearSnack: () => void;
}

export const useManifestStore = create<ManifestState>((set) => ({
  currentManifest: null,
  setCurrentManifest: (manifest) => set({ currentManifest: manifest }),
  clearManifest: () => set({ currentManifest: null }),

  activeTab: "overview",
  sourceValue: "",
  sourceLanguage: "json",
  snackMessage: null,
  snackOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSourceValue: (value) => set({ sourceValue: value }),
  setSourceLanguage: (lang) => set({ sourceLanguage: lang }),
  setSnackMessage: (message) => set({ snackMessage: message, snackOpen: message != null }),
  setSnackOpen: (open) => set({ snackOpen: open }),
  showSnack: (message) => set({ snackMessage: message, snackOpen: true }),

  resetEditorFromBundle: (manifestBundle) => {
    if (manifestBundle == null) return;
    set({
      sourceValue: JSON.stringify(manifestBundle, null, 2),
      sourceLanguage: "json",
    });
  },

  clearSnack: () => set({ snackMessage: null, snackOpen: false }),
}));
