import { create } from "zustand";

interface RealtimeState {
  recentlyUpdatedArtifactIds: Record<string, number>;
  presenceByArtifactId: Record<string, string[]>;
  markArtifactUpdated: (artifactId: string) => void;
  setArtifactPresence: (artifactId: string, viewerIds: string[]) => void;
  isRecentlyUpdated: (artifactId: string, ttlMs?: number) => boolean;
  prune: (ttlMs?: number) => void;
}

const DEFAULT_TTL_MS = 20_000;

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  recentlyUpdatedArtifactIds: {},
  presenceByArtifactId: {},
  markArtifactUpdated: (artifactId: string) =>
    set((state) => ({
      recentlyUpdatedArtifactIds: {
        ...state.recentlyUpdatedArtifactIds,
        [artifactId]: Date.now(),
      },
    })),
  setArtifactPresence: (artifactId: string, viewerIds: string[]) =>
    set((state) => ({
      presenceByArtifactId: {
        ...state.presenceByArtifactId,
        [artifactId]: viewerIds,
      },
    })),
  isRecentlyUpdated: (artifactId: string, ttlMs = DEFAULT_TTL_MS) => {
    const ts = get().recentlyUpdatedArtifactIds[artifactId];
    if (!ts) return false;
    return Date.now() - ts <= ttlMs;
  },
  prune: (ttlMs = DEFAULT_TTL_MS) =>
    set((state) => {
      const now = Date.now();
      const next: Record<string, number> = {};
      for (const [id, ts] of Object.entries(state.recentlyUpdatedArtifactIds)) {
        if (now - ts <= ttlMs) next[id] = ts;
      }
      return { recentlyUpdatedArtifactIds: next };
    }),
}));
