import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  ListItemButton,
  Menu,
  Divider,
} from "@mui/material";
import { Folder, ExpandMore, FolderOpen, Add, Star, StarBorder } from "@mui/icons-material";
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
  /** When true, show only icon (for collapsed sidebar). */
  collapsed?: boolean;
  onNavigate?: () => void;
}

function projectRow(
  p: Project,
  projectSlug: string | undefined,
  handleSelect: (project: Project) => void,
  togglePin: (e: React.MouseEvent, slug: string) => void,
  pinnedSlugs: string[],
) {
  const isCurrent = p.slug === projectSlug;
  const isPinned = pinnedSlugs.includes(p.slug);
  return (
    <ListItemButton
      key={p.id}
      selected={isCurrent}
      onClick={() => handleSelect(p)}
      sx={{
        borderRadius: 1,
        mx: 0.5,
        mb: 0.25,
        "&.Mui-selected": {
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "&:hover": { bgcolor: "primary.dark" },
          "& .MuiIconButton-root": { color: "inherit" },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        {isCurrent ? (
          <FolderOpen fontSize="small" />
        ) : (
          <Folder fontSize="small" color="action" />
        )}
      </ListItemIcon>
      <ListItemText
        primary={p.name}
        primaryTypographyProps={{ noWrap: true, variant: "body2" }}
        secondary={p.slug !== p.name ? p.slug : undefined}
        secondaryTypographyProps={{ noWrap: true, variant: "caption" }}
      />
      <IconButton
        size="small"
        onClick={(e) => togglePin(e, p.slug)}
        aria-label={isPinned ? "Unpin project" : "Pin project"}
        sx={{ ml: 0.5 }}
      >
        {isPinned ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
      </IconButton>
    </ListItemButton>
  );
}

export function ProjectSwitcher({ collapsed = false, onNavigate }: ProjectSwitcherProps) {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
        const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, MAX_PINNED);
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
    setAnchorEl(null);
    // Return focus to trigger so keyboard users land back on "current project" button
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

  const open = Boolean(anchorEl);

  const triggerButton = (
    <Button
      ref={triggerRef}
      fullWidth
      onClick={(e) => setAnchorEl(e.currentTarget)}
      aria-label="Switch project"
      aria-expanded={open}
      aria-haspopup="listbox"
      startIcon={collapsed ? null : <FolderOpen fontSize="small" />}
      endIcon={collapsed ? null : <ExpandMore fontSize="small" />}
      title={collapsed ? (currentProject?.name ?? projectSlug) : undefined}
      sx={{
        justifyContent: collapsed ? "center" : "flex-start",
        minWidth: 0,
        px: collapsed ? 1 : 1.5,
        color: "text.primary",
        textTransform: "none",
        bgcolor: "action.selected",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {collapsed ? (
        <FolderOpen fontSize="small" />
      ) : (
        <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, textAlign: "left" }}>
          {currentProject?.name ?? projectSlug}
        </Typography>
      )}
    </Button>
  );

  const listContent = (
    <>
      {isLoading ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      ) : projects.length === 0 ? (
        <Box sx={{ px: 2, py: 2, minWidth: 220 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            No projects
          </Typography>
          <Button
            component={Link}
            to={orgSlug ? `/${orgSlug}` : "#"}
            variant="outlined"
            size="small"
            startIcon={<Add />}
            fullWidth
            onClick={() => { handleClose(); onNavigate?.(); }}
          >
            Go to projects
          </Button>
        </Box>
      ) : (
        <Box sx={{ maxHeight: 320, overflowY: "auto", minWidth: 260 }}>
          {pinnedSlugs.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1, pb: 0.5, display: "block" }}>
                Pinned
              </Typography>
              {sortedProjects
                .filter((p) => pinnedSlugs.includes(p.slug))
                .map((p) => projectRow(p, projectSlug, handleSelect, togglePin, pinnedSlugs))}
              <Divider sx={{ my: 1 }} />
            </>
          )}
          {sortedProjects
            .filter((p) => !pinnedSlugs.includes(p.slug))
            .map((p) => projectRow(p, projectSlug, handleSelect, togglePin, pinnedSlugs))}
        </Box>
      )}
    </>
  );

  return (
    <Box sx={{ py: 0.5 }}>
      {triggerButton}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: 1.5 } } }}
      >
        {listContent}
      </Menu>
    </Box>
  );
}
