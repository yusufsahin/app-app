/**
 * Unit tests for projectStore: lastVisited, currentProject, listState.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "./projectStore";
import type { Project } from "../api/types";

const mockProject: Project = {
  id: "proj-1",
  slug: "proj-1",
  name: "Test Project",
  code: "TP",
  description: "",
  status: "active",
};

describe("projectStore", () => {
  beforeEach(() => {
    useProjectStore.getState().clearAll();
  });

  describe("lastVisitedProjectSlug", () => {
    it("updates lastVisitedProjectSlug when setLastVisitedProjectSlug is called", () => {
      expect(useProjectStore.getState().lastVisitedProjectSlug).toBeNull();
      useProjectStore.getState().setLastVisitedProjectSlug("my-proj");
      expect(useProjectStore.getState().lastVisitedProjectSlug).toBe("my-proj");
    });

    it("clears lastVisitedProjectSlug on clearAll", () => {
      useProjectStore.getState().setLastVisitedProjectSlug("p1");
      useProjectStore.getState().clearAll();
      expect(useProjectStore.getState().lastVisitedProjectSlug).toBeNull();
    });
  });

  describe("currentProject", () => {
    it("sets and clears currentProject", () => {
      expect(useProjectStore.getState().currentProject).toBeNull();
      useProjectStore.getState().setCurrentProject(mockProject);
      expect(useProjectStore.getState().currentProject).toEqual(mockProject);
      useProjectStore.getState().clearCurrentProject();
      expect(useProjectStore.getState().currentProject).toBeNull();
    });

    it("clearAll clears currentProject", () => {
      useProjectStore.getState().setCurrentProject(mockProject);
      useProjectStore.getState().clearAll();
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  describe("listState", () => {
    it("setCreateModalOpen updates createModalOpen", () => {
      expect(useProjectStore.getState().listState.createModalOpen).toBe(false);
      useProjectStore.getState().setCreateModalOpen(true);
      expect(useProjectStore.getState().listState.createModalOpen).toBe(true);
    });

    it("resetListState restores default list state", () => {
      useProjectStore.getState().setCreateModalOpen(true);
      useProjectStore.getState().resetListState();
      expect(useProjectStore.getState().listState).toEqual({
        createModalOpen: false,
      });
    });

    it("clearAll resets listState to default", () => {
      useProjectStore.getState().setCreateModalOpen(true);
      useProjectStore.getState().clearAll();
      expect(useProjectStore.getState().listState).toEqual({
        createModalOpen: false,
      });
    });
  });
});
