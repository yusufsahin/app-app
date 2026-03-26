import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { Folder, FolderOpen, ChevronDown, Plus, Star } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui";
import { useOrgProjects } from "../../api/orgApi";
import { useProjectStore } from "../../stores/projectStore";
import {
  MAX_PINNED,
  getPinnedSlugs,
  setPinnedSlugs,
  getProjectSegment,
} from "../../utils/projectSwitcherUtils";
import type { Project } from "../../api/types";

interface ProjectSwitcherProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function ProjectRow({
  p,
  projectSlug,
  pinnedSlugs,
  onSelect,
  onTogglePin,
}: {
  p: Project;
  projectSlug: string | undefined;
  pinnedSlugs: string[];
  onSelect: (project: Project) => void;
  onTogglePin: (e: React.MouseEvent, slug: string) => void;
}) {
  const isCurrent = p.slug === projectSlug;
  const isPinned = pinnedSlugs.includes(p.slug);

  return (
    <DropdownMenuItem
      onSelect={() => onSelect(p)}
      className="flex cursor-pointer items-center gap-2 rounded-md py-2"
      data-active={isCurrent}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {isCurrent ? (
          <FolderOpen className="size-4" />
        ) : (
          <Folder className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p.name}</span>
        {p.slug !== p.name && (
          <span className="block truncate text-xs text-muted-foreground">{p.slug}</span>
        )}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin(e, p.slug);
        }}
        className="shrink-0 rounded p-1 hover:bg-sidebar-accent"
        aria-label={isPinned ? "Unpin project" : "Pin project"}
      >
        {isPinned ? (
          <Star className="size-4 fill-current" />
        ) : (
          <Star className="size-4 fill-none" />
        )}
      </button>
    </DropdownMenuItem>
  );
}

export function ProjectSwitcher({ collapsed = false, onNavigate }: ProjectSwitcherProps) {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pinnedSlugs, setPinnedSlugsState] = useState<string[]>(() => getPinnedSlugs(orgSlug));
  const { data: projects = [], isLoading } = useOrgProjects(orgSlug);
  const currentProject = projects.find((p) => p.slug === projectSlug);
  const setLastVisitedProjectSlug = useProjectStore((s) => s.setLastVisitedProjectSlug);

  useEffect(() => {
    setPinnedSlugsState(getPinnedSlugs(orgSlug));
  }, [orgSlug]);

  const togglePin = useCallback(
    (e: React.MouseEvent, slug: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!orgSlug) return;
      setPinnedSlugsState((prev) => {
        const next = prev.includes(slug)
          ? prev.filter((s) => s !== slug)
          : [...prev, slug].slice(0, MAX_PINNED);
        setPinnedSlugs(orgSlug, next);
        return next;
      });
    },
    [orgSlug],
  );

  const sortedProjects = useMemo(() => {
    if (projects.length === 0) return [];
    const pinned = pinnedSlugs
      .map((slug) => projects.find((p) => p.slug === slug))
      .filter((p): p is Project => p != null);
    const rest = projects.filter((p) => !pinnedSlugs.includes(p.slug));
    return [...pinned, ...rest];
  }, [projects, pinnedSlugs]);

  const handleClose = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const handleSelect = (project: Project) => {
    if (!orgSlug || project.slug === projectSlug) {
      handleClose();
      onNavigate?.();
      return;
    }
    setLastVisitedProjectSlug(project.slug);
    const segment = getProjectSegment(location.pathname);
    const path = segment
      ? `/${orgSlug}/${project.slug}/${segment}`
      : `/${orgSlug}/${project.slug}`;
    navigate(path);
    handleClose();
    onNavigate?.();
  };

  if (!orgSlug || !projectSlug) return null;

  const triggerButton = (
    <Button
      ref={triggerRef}
      variant="ghost"
      className="h-8 w-full justify-between gap-1 px-2 font-normal"
      onClick={() => setOpen(true)}
      aria-label="Switch project"
      aria-expanded={open}
      aria-haspopup="listbox"
      title={collapsed ? currentProject?.name ?? projectSlug : undefined}
    >
      {collapsed ? (
        <FolderOpen className="size-4 shrink-0" />
      ) : (
        <>
          <FolderOpen className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">
            {currentProject?.name ?? projectSlug}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </>
      )}
    </Button>
  );

  return (
    <div className="py-0.5">
      <DropdownMenu
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[260px]">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : projects.length === 0 ? (
            <div className="space-y-2 px-3 py-4">
              <p className="text-sm text-muted-foreground">No projects</p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link to={orgSlug ? `/${orgSlug}` : "#"} onClick={() => { handleClose(); onNavigate?.(); }}>
                  <Plus className="mr-2 size-4" />
                  Go to projects
                </Link>
              </Button>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {pinnedSlugs.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Pinned</DropdownMenuLabel>
                  {sortedProjects
                    .filter((p) => pinnedSlugs.includes(p.slug))
                    .map((p) => (
                      <ProjectRow
                        key={p.id}
                        p={p}
                        projectSlug={projectSlug}
                        pinnedSlugs={pinnedSlugs}
                        onSelect={handleSelect}
                        onTogglePin={togglePin}
                      />
                    ))}
                  <DropdownMenuSeparator />
                </>
              )}
              {sortedProjects
                .filter((p) => !pinnedSlugs.includes(p.slug))
                .map((p) => (
                  <ProjectRow
                    key={p.id}
                    p={p}
                    projectSlug={projectSlug}
                    pinnedSlugs={pinnedSlugs}
                    onSelect={handleSelect}
                    onTogglePin={togglePin}
                  />
                ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
