import { ChevronRight, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  TabsContent,
} from "../../../shared/components/ui";
import type {
  ArtifactImpactAnalysisNode,
  ArtifactImpactAnalysisResponse,
} from "../../../shared/api/relationshipApi";
import { getArtifactIcon } from "../utils";

interface ImpactTypeOption {
  value: string;
  label: string;
}

interface ArtifactDetailImpactAnalysisProps {
  analysis: ArtifactImpactAnalysisResponse | undefined;
  isLoading: boolean;
  selectedRelationshipTypes: string[];
  relationshipTypeOptions: ImpactTypeOption[];
  depth: number;
  onDepthChange: (depth: number) => void;
  onToggleRelationshipType: (relationshipType: string, checked: boolean) => void;
  onRefresh: () => void;
  onOpenArtifact: (artifactId: string) => void;
  iconBundle?: {
    artifact_types?: Array<{ id?: string; icon?: string }>;
  };
}

export function ArtifactDetailImpactAnalysis({
  analysis,
  isLoading,
  selectedRelationshipTypes,
  relationshipTypeOptions,
  depth,
  onDepthChange,
  onToggleRelationshipType,
  onRefresh,
  onOpenArtifact,
  iconBundle,
}: ArtifactDetailImpactAnalysisProps) {
  const noTypesSelected = selectedRelationshipTypes.length === 0;

  return (
    <TabsContent value="impact" className="space-y-4 py-2">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Impact analysis</p>
            <p className="text-xs text-muted-foreground">
              Trace upstream and downstream effects for the selected artifact.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(depth)} onValueChange={(value) => onDepthChange(Number(value))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Depth" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Depth 1</SelectItem>
                <SelectItem value="2">Depth 2</SelectItem>
                <SelectItem value="3">Depth 3</SelectItem>
                <SelectItem value="4">Depth 4</SelectItem>
                <SelectItem value="5">Depth 5</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {relationshipTypeOptions.map((option) => {
            const checked = selectedRelationshipTypes.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onToggleRelationshipType(option.value, value === true)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {noTypesSelected ? (
        <p className="text-sm text-muted-foreground">Select at least one relationship type to analyze impact.</p>
      ) : isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-48 rounded-md" />
          <Skeleton className="h-48 rounded-md" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ImpactColumn
            title="Trace From"
            description="Artifacts that can affect the current item."
            nodes={analysis?.trace_from ?? []}
            onOpenArtifact={onOpenArtifact}
            iconBundle={iconBundle}
          />
          <ImpactColumn
            title="Trace To"
            description="Artifacts that may be affected by the current item."
            nodes={analysis?.trace_to ?? []}
            onOpenArtifact={onOpenArtifact}
            iconBundle={iconBundle}
          />
        </div>
      )}
    </TabsContent>
  );
}

function ImpactColumn({
  title,
  description,
  nodes,
  onOpenArtifact,
  iconBundle,
}: {
  title: string;
  description: string;
  nodes: ArtifactImpactAnalysisNode[];
  onOpenArtifact: (artifactId: string) => void;
  iconBundle?: {
    artifact_types?: Array<{ id?: string; icon?: string }>;
  };
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-3">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No related impact found.</p>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <ImpactNodeTree
              key={`${node.relationship_id ?? "root"}-${node.artifact_id}`}
              node={node}
              onOpenArtifact={onOpenArtifact}
              iconBundle={iconBundle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactNodeTree({
  node,
  onOpenArtifact,
  iconBundle,
}: {
  node: ArtifactImpactAnalysisNode;
  onOpenArtifact: (artifactId: string) => void;
  iconBundle?: {
    artifact_types?: Array<{ id?: string; icon?: string }>;
  };
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border bg-muted/10 p-3">
        {node.hierarchy_path.length > 0 && (
          <p className="mb-2 text-[11px] text-muted-foreground">
            {node.hierarchy_path.map((item) => item.title).join(" / ")}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 text-left"
            onClick={() => onOpenArtifact(node.artifact_id)}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              {getArtifactIcon(node.artifact_type, iconBundle)}
              <span>{node.title}</span>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {node.artifact_key ?? node.artifact_id}
            </span>
          </button>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {node.relationship_label ? (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {node.relationship_label}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="text-xs">
              {node.state}
            </Badge>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Type: {node.artifact_type}</p>
        {node.has_more && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronRight className="size-3" />
            More related artifacts exist beyond the selected depth.
          </p>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="ml-4 border-l border-border pl-3">
          {node.children.map((child) => (
            <ImpactNodeTree
              key={`${child.relationship_id ?? "root"}-${child.artifact_id}`}
              node={child}
              onOpenArtifact={onOpenArtifact}
              iconBundle={iconBundle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
