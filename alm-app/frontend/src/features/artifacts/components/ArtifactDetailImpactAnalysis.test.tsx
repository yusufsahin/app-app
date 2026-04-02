/** @vitest-environment jsdom */

import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../../../shared/components/ui";
import { renderWithQualityI18n } from "../../../test/renderWithQualityI18n";
import { ArtifactDetailImpactAnalysis } from "./ArtifactDetailImpactAnalysis";

describe("ArtifactDetailImpactAnalysis", () => {
  it("renders impact trees and forwards actions", () => {
    const onRefresh = vi.fn();
    const onOpenArtifact = vi.fn();
    const onToggleRelationshipType = vi.fn();
    const onDepthChange = vi.fn();

    renderWithQualityI18n(
      <Tabs value="impact">
        <ArtifactDetailImpactAnalysis
          isLoading={false}
          analysis={{
            focus_artifact: {
              id: "focus-1",
              project_id: "project-1",
              artifact_type: "user_story",
              title: "Focus item",
              description: "",
              state: "active",
              assignee_id: null,
              parent_id: null,
              custom_fields: {},
              artifact_key: "US-1",
              tags: [],
              allowed_actions: [],
            },
            trace_from: [
              {
                artifact_id: "upstream-1",
                artifact_key: "FEAT-1",
                artifact_type: "feature",
                title: "Upstream feature",
                state: "active",
                parent_id: null,
                relationship_id: "rel-1",
                relationship_type: "blocks",
                relationship_label: "Blocked By",
                direction: "incoming",
                depth: 1,
                has_more: false,
                hierarchy_path: [],
                children: [],
              },
            ],
            trace_to: [
              {
                artifact_id: "downstream-1",
                artifact_key: "REQ-1",
                artifact_type: "requirement",
                title: "Downstream requirement",
                state: "new",
                parent_id: "focus-1",
                relationship_id: "rel-2",
                relationship_type: "impacts",
                relationship_label: "Impacts",
                direction: "outgoing",
                depth: 1,
                has_more: true,
                hierarchy_path: [{ id: "focus-1", artifact_key: "US-1", title: "Focus item", artifact_type: "user_story" }],
                children: [
                  {
                    artifact_id: "us-deep-1",
                    artifact_key: "US-2",
                    artifact_type: "user_story",
                    title: "Follow-up story",
                    state: "new",
                    parent_id: "downstream-1",
                    relationship_id: "rel-3",
                    relationship_type: "impacts",
                    relationship_label: "Impacts",
                    direction: "outgoing",
                    depth: 2,
                    has_more: false,
                    hierarchy_path: [],
                    children: [],
                  },
                ],
              },
            ],
            applied_relationship_types: ["impacts", "blocks"],
            depth: 2,
          }}
          selectedRelationshipTypes={["impacts", "blocks"]}
          relationshipTypeOptions={[
            { value: "impacts", label: "Impacts" },
            { value: "blocks", label: "Blocks" },
          ]}
          depth={2}
          onDepthChange={onDepthChange}
          onToggleRelationshipType={onToggleRelationshipType}
          onRefresh={onRefresh}
          onOpenArtifact={onOpenArtifact}
        />
      </Tabs>,
    );

    expect(screen.getByText("Impact analysis")).toBeInTheDocument();
    expect(screen.getByText("Trace From")).toBeInTheDocument();
    expect(screen.getByText("Trace To")).toBeInTheDocument();
    expect(screen.getByText("Upstream feature")).toBeInTheDocument();
    expect(screen.getByText("Downstream requirement")).toBeInTheDocument();
    expect(screen.getByText("Follow-up story")).toBeInTheDocument();
    expect(screen.getByText("More related artifacts exist beyond the selected depth.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Upstream feature/i }));
    expect(onOpenArtifact).toHaveBeenCalledWith("upstream-1");

    fireEvent.click(screen.getByLabelText("Impacts"));
    expect(onToggleRelationshipType).toHaveBeenCalled();
  });

  it("shows guidance when no relationship type is selected", () => {
    renderWithQualityI18n(
      <Tabs value="impact">
        <ArtifactDetailImpactAnalysis
          isLoading={false}
          analysis={undefined}
          selectedRelationshipTypes={[]}
          relationshipTypeOptions={[{ value: "impacts", label: "Impacts" }]}
          depth={2}
          onDepthChange={vi.fn()}
          onToggleRelationshipType={vi.fn()}
          onRefresh={vi.fn()}
          onOpenArtifact={vi.fn()}
        />
      </Tabs>,
    );

    expect(screen.getByText("Select at least one relationship type to analyze impact.")).toBeInTheDocument();
  });
});
