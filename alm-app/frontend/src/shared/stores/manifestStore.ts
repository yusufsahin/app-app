import { create } from "zustand";

/**
 * Placeholder for manifest state.
 * Manifest is part of process templates (manifest_bundle) in the backend.
 * This store will hold current manifest context when manifest UI is added.
 */
export interface ManifestContext {
  projectId: string;
  versionId: string;
  manifestBundle?: Record<string, unknown>;
}

interface ManifestState {
  currentManifest: ManifestContext | null;
  setCurrentManifest: (manifest: ManifestContext | null) => void;
  clearManifest: () => void;
}

export const useManifestStore = create<ManifestState>((set) => ({
  currentManifest: null,

  setCurrentManifest: (manifest) => set({ currentManifest: manifest }),

  clearManifest: () => set({ currentManifest: null }),
}));
