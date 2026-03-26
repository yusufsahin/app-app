import { describe, expect, it } from "vitest";
import { useRealtimeStore } from "./realtimeStore";

describe("realtimeStore", () => {
  it("marks artifact as recently updated", () => {
    useRealtimeStore.setState({
      recentlyUpdatedArtifactIds: {},
      presenceByArtifactId: {},
    });
    useRealtimeStore.getState().markArtifactUpdated("a1");
    expect(useRealtimeStore.getState().isRecentlyUpdated("a1")).toBe(true);
  });

  it("stores presence viewers", () => {
    useRealtimeStore.setState({
      recentlyUpdatedArtifactIds: {},
      presenceByArtifactId: {},
    });
    useRealtimeStore.getState().setArtifactPresence("a2", ["u1", "u2"]);
    expect(useRealtimeStore.getState().presenceByArtifactId["a2"]).toEqual(["u1", "u2"]);
  });
});
