import { Trash2 } from "lucide-react";
import { Badge, Button, Skeleton, TabsContent } from "../../../shared/components/ui";
import { Link } from "react-router-dom";
import type { ArtifactRelationship } from "../../../shared/api/relationshipApi";

interface ArtifactDetailLinksProps {
  links: ArtifactRelationship[];
  linksLoading: boolean;
  buildArtifactPath: (artifactId: string) => string;
  onOpenArtifact: (artifactId: string) => void;
  onRemoveLink: (link: ArtifactRelationship) => void;
  onAddLink: () => void;
}

export function ArtifactDetailLinks({
  links,
  linksLoading,
  buildArtifactPath,
  onOpenArtifact,
  onRemoveLink,
  onAddLink,
}: ArtifactDetailLinksProps) {
  const groupedLinks = links.reduce<Record<string, ArtifactRelationship[]>>((acc, link) => {
    const bucket = `${link.category}:${link.display_label}`;
    acc[bucket] = [...(acc[bucket] ?? []), link];
    return acc;
  }, {});

  return (
    <TabsContent value="links" className="py-2">
      <p className="mb-2 text-sm font-medium text-muted-foreground">Links</p>
      {linksLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedLinks).map(([groupKey, items]) => (
                <div key={groupKey} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{items[0]?.display_label}</p>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {items[0]?.category}
                    </Badge>
                  </div>
                  <ul className="space-y-2">
                    {items.map((link) => (
                      <li key={link.id} className="flex items-center justify-between gap-2 py-1">
                        <div className="min-w-0">
                          <Link
                            to={buildArtifactPath(link.other_artifact_id)}
                            className="font-medium text-foreground hover:underline"
                            onClick={() => onOpenArtifact(link.other_artifact_id)}
                          >
                            {link.other_artifact_title}
                          </Link>
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {link.direction === "outgoing" ? "→" : "←"} {link.relationship_type}
                          </Badge>
                          {link.other_artifact_key ? (
                            <span className="ml-2 text-xs text-muted-foreground">{link.other_artifact_key}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md text-destructive hover:bg-muted"
                          aria-label="Remove relationship"
                          onClick={() => onRemoveLink(link)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" className="mt-2" onClick={onAddLink}>
            Add relationship
          </Button>
        </>
      )}
    </TabsContent>
  );
}
