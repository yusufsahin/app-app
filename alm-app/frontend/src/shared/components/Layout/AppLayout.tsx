import { useState, useEffect, useMemo } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Outlet, useNavigate, useLocation, useParams, Navigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  Avatar,
  Divider,
  Popover,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Folder,
  Settings,
  Logout,
  Add,
  ChevronLeft,
  ChevronRight,
  Dashboard,
  History,
  FolderOpen,
  CalendarMonth,
  ViewList,
  ViewColumn,
  AutoAwesome,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useOrgProjects } from "../../api/orgApi";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteItem } from "./CommandPalette";
import { useTenantStore } from "../../stores/tenantStore";
import { useProjectStore } from "../../stores/projectStore";
import { useArtifactStore } from "../../stores/artifactStore";
import { useLayoutUI } from "../../contexts/LayoutUIContext";
import { useSwitchTenant } from "../../api/authApi";
import { ModalManager } from "../../modal";
import { useNotificationStore } from "../../stores/notificationStore";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "../../utils/permissions";
import { useRealtime } from "../../realtime/useRealtime";

const DRAWER_WIDTH_EXPANDED = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Single required permission */
  permission?: string;
  /** Show if user has ANY of these (for umbrella pages like Settings) */
  permissionAny?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Projects", path: "", icon: <Folder />, permission: "project:read" },
  { label: "Dashboard", path: "dashboard", icon: <Dashboard />, permission: "project:read" },
];

/** Project-scoped nav (shown when URL has projectSlug). Paths relative to /:orgSlug/:projectSlug. Manifest is under Organization settings, not here. */
const PROJECT_NAV_ITEMS: NavItem[] = [
  { label: "Overview", path: "", icon: <FolderOpen />, permission: "project:read" },
  { label: "Planning", path: "planning", icon: <CalendarMonth />, permission: "project:read" },
  { label: "Artifacts", path: "artifacts", icon: <ViewList />, permission: "artifact:read" },
  { label: "Board", path: "board", icon: <ViewColumn />, permission: "artifact:read" },
  { label: "Automation", path: "automation", icon: <AutoAwesome />, permission: "project:read" },
];

export default function AppLayout() {
  useRealtime();
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const theme = useTheme();
  const { data: projects = [] } = useOrgProjects(orgSlug);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setLastVisitedProjectSlug = useProjectStore((s) => s.setLastVisitedProjectSlug);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);

  // Sync URL project to store (and lastVisited) so Switcher and Dashboard use correct context
  useEffect(() => {
    if (!orgSlug) return;
    if (projectSlug && projects.length > 0) {
      const project = projects.find((p) => p.slug === projectSlug);
      if (project) {
        setCurrentProject(project);
        setLastVisitedProjectSlug(projectSlug);
      } else {
        setCurrentProject(null);
      }
    } else {
      clearCurrentProject();
    }
  }, [orgSlug, projectSlug, projects, setCurrentProject, setLastVisitedProjectSlug, clearCurrentProject]);
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const tenants = useTenantStore((s) => s.tenants);
  const setTenant = useTenantStore((s) => s.setTenant);
  const clearTenant = useTenantStore((s) => s.clearTenant);
  const clearProjectStore = useProjectStore((s) => s.clearAll);
  const clearArtifactStore = useArtifactStore((s) => s.clearAll);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const switchTenantMutation = useSwitchTenant();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [tenantAnchor, setTenantAnchor] = useState<null | HTMLElement>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useLayoutUI();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isCollapsed = isDesktop && sidebarCollapsed;
  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.permission) return hasPermission(permissions, item.permission);
    if (item.permissionAny)
      return item.permissionAny.some((p) => hasPermission(permissions, p));
    return true;
  });

  const commandPaletteItems: CommandPaletteItem[] = useMemo(() => {
    if (!orgSlug) return [];
    const list: CommandPaletteItem[] = [];
    for (const item of visibleNavItems) {
      const path = item.path ? `/${orgSlug}/${item.path}` : `/${orgSlug}`;
      list.push({ id: item.path || "projects", label: item.label, path, icon: item.icon });
    }
    if (projectSlug) {
      const projectItems = PROJECT_NAV_ITEMS.filter((item) => {
        if (item.permission) return hasPermission(permissions, item.permission);
        if (item.permissionAny) return item.permissionAny.some((p) => hasPermission(permissions, p));
        return true;
      });
      for (const item of projectItems) {
        const path = item.path ? `/${orgSlug}/${projectSlug}/${item.path}` : `/${orgSlug}/${projectSlug}`;
        list.push({ id: `proj-${item.path || "overview"}`, label: item.label, path, icon: item.icon });
      }
    }
    if (hasPermission(permissions, "tenant:read") || hasPermission(permissions, "member:read") || hasPermission(permissions, "role:read")) {
      list.push({ id: "settings", label: "Organization settings", path: `/${orgSlug}/settings`, icon: <Settings fontSize="small" /> });
    }
    if (isAdmin) {
      list.push({ id: "audit", label: "Access audit", path: `/${orgSlug}/audit`, icon: <History fontSize="small" /> });
    }
    return list;
  }, [orgSlug, projectSlug, visibleNavItems, permissions, isAdmin]);

  // OrgGuard: URL org must match current tenant (JWT is tenant-scoped)
  if (
    orgSlug &&
    currentTenant?.slug &&
    orgSlug !== currentTenant.slug
  ) {
    return <Navigate to={`/${currentTenant.slug}`} replace />;
  }

  const handleLogout = () => {
    setUserMenuAnchor(null);
    logout();
    clearTenant();
    clearProjectStore();
    clearArtifactStore();
    queryClient.clear();
    navigate("/login");
  };

  const handleSwitchTenant = async (tenantId: string) => {
    if (!accessToken || tenantId === currentTenant?.id) {
      setTenantAnchor(null);
      return;
    }
    try {
      const result = await switchTenantMutation.mutateAsync({
        tenantId,
        token: accessToken,
      });
      setTokens(result.access_token, result.refresh_token);
      const selected = tenants.find((t) => t.id === tenantId);
      if (selected) {
        setTenant(selected);
        useProjectStore.getState().clearCurrentProject();
        useArtifactStore.getState().clearAll();
        navigate(`/${selected.slug}`);
      }
      queryClient.clear();
      setTenantAnchor(null);
      showNotification("Switched organization successfully");
    } catch {
      showNotification("Failed to switch organization", "error");
      setTenantAnchor(null);
    }
  };

  const userInitial = user?.display_name?.charAt(0).toUpperCase() ?? "U";

  const orgInitial = (currentTenant?.name ?? "O").charAt(0).toUpperCase();

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        onClick={(e) => setTenantAnchor(e.currentTarget)}
        sx={{
          p: isCollapsed ? 1.5 : 2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          bgcolor: "action.selected",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: "primary.main",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {orgInitial}
        </Avatar>
        {!isCollapsed && (
          <Box sx={{ flex: 1, minWidth: 0, ml: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {currentTenant?.name ?? "No Organization"}
            </Typography>
            {currentTenant?.slug && (
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {currentTenant.slug}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {!isCollapsed && (
        <ListItemButton
          onClick={() => {
            navigate("/select-tenant");
            setMobileOpen(false);
          }}
          sx={{
            mx: 1,
            mt: 1,
            borderRadius: 1,
            justifyContent: "flex-start",
            color: "primary.main",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Add fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2" fontWeight={500}>
            New organization
          </Typography>
        </ListItemButton>
      )}

      <Divider sx={{ mt: 1 }} />

      <List sx={{ flex: 1, px: isCollapsed ? 0.5 : 1, py: 1.5 }}>
        {visibleNavItems.map((item) => {
          const basePath = orgSlug ? `/${orgSlug}` : "";
          const fullPath = item.path ? `${basePath}/${item.path}` : basePath || "/";
          const isActive = item.path === ""
            ? location.pathname === basePath || location.pathname === `${basePath}/`
            : location.pathname.startsWith(`${basePath}/${item.path}`);

          return (
            <ListItemButton
              key={item.path || "projects"}
              onClick={() => {
                navigate(fullPath);
                setMobileOpen(false);
              }}
              selected={isActive}
              title={isCollapsed ? item.label : undefined}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                justifyContent: isCollapsed ? "center" : "flex-start",
                px: isCollapsed ? 1 : 2,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 40 }}>
                {item.icon}
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      {projectSlug && (
        <>
          <Divider sx={{ mt: 0.5 }} />
          <ProjectSwitcher
            collapsed={isCollapsed}
            onNavigate={() => setMobileOpen(false)}
          />
          <List sx={{ px: isCollapsed ? 0.5 : 1, py: 0.5 }}>
            {PROJECT_NAV_ITEMS.filter((item) => {
              if (item.permission) return hasPermission(permissions, item.permission);
              if (item.permissionAny) return item.permissionAny.some((p) => hasPermission(permissions, p));
              return true;
            }).map((item) => {
              const basePath = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "";
              const fullPath = item.path ? `${basePath}/${item.path}` : basePath;
              const isActive =
                item.path === ""
                  ? location.pathname === basePath || location.pathname === `${basePath}/`
                  : location.pathname.startsWith(`${basePath}/${item.path}`);
              return (
                <ListItemButton
                  key={item.path || "overview"}
                  onClick={() => {
                    navigate(fullPath);
                    setMobileOpen(false);
                  }}
                  selected={isActive}
                  title={isCollapsed ? item.label : undefined}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    px: isCollapsed ? 1 : 2,
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      "&:hover": { bgcolor: "primary.dark" },
                      "& .MuiListItemIcon-root": { color: "inherit" },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  {!isCollapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </>
      )}

      {(hasPermission(permissions, "tenant:read") ||
        hasPermission(permissions, "member:read") ||
        hasPermission(permissions, "role:read")) && (
        <>
          <Divider />
          <List sx={{ py: 0 }}>
            <ListItemButton
              onClick={() => {
                navigate(orgSlug ? `/${orgSlug}/settings` : "/");
                setMobileOpen(false);
              }}
              selected={
                location.pathname === `/${orgSlug}/settings` ||
                location.pathname === `/${orgSlug}/members` ||
                location.pathname === `/${orgSlug}/roles` ||
                location.pathname === `/${orgSlug}/privileges` ||
                location.pathname === `/${orgSlug}/audit`
              }
              title={isCollapsed ? "Organization settings" : undefined}
              sx={{
                borderRadius: 1,
                mx: isCollapsed ? 0.5 : 1,
                mb: 0.5,
                justifyContent: isCollapsed ? "center" : "flex-start",
              }}
            >
              <ListItemIcon sx={{ minWidth: isCollapsed ? 0 : 40 }}>
                <Settings fontSize="small" />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText
                  primary="Organization settings"
                  primaryTypographyProps={{ variant: "body2" }}
                />
              )}
            </ListItemButton>
          </List>
        </>
      )}

      {isDesktop && (
        <>
          <Divider />
          <Box sx={{ p: 0.5, display: "flex", justifyContent: "center" }}>
            <IconButton
              size="small"
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              sx={{ color: "text.secondary" }}
            >
              {isCollapsed ? (
                <ChevronRight fontSize="small" />
              ) : (
                <ChevronLeft fontSize="small" />
              )}
            </IconButton>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: (theme) =>
            theme.transitions.create(["margin", "width"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flex: 1 }} />

          <Chip
            label={typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K"}
            size="small"
            onClick={() => setCommandPaletteOpen(true)}
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              mr: 1,
              "& .MuiChip-label": { fontSize: "0.75rem" },
              cursor: "pointer",
            }}
            title="Quick navigation"
          />

          <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} sx={{ ml: 1 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                fontSize: 16,
              }}
            >
              {userInitial}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={userMenuAnchor}
            open={!!userMenuAnchor}
            onClose={() => setUserMenuAnchor(null)}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <Box sx={{ px: 2, py: 1, minWidth: 180 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.display_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={handleLogout}
              sx={{ color: "error.main", gap: 1 }}
            >
              <Logout fontSize="small" />
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH_EXPANDED },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              borderRight: 1,
              borderColor: "divider",
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: (theme) =>
                theme.transitions.create("width", {
                  easing: theme.transitions.easing.sharp,
                  duration: theme.transitions.duration.enteringScreen,
                }),
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Popover
        open={!!tenantAnchor}
        anchorEl={tenantAnchor}
        onClose={() => setTenantAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 260, p: 1 } } }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
          Switch organization
        </Typography>
        <ListItemButton
          onClick={() => {
            setTenantAnchor(null);
            navigate("/select-tenant");
          }}
          sx={{ borderRadius: 1 }}
        >
          <Add fontSize="small" sx={{ mr: 1.5 }} />
          <Typography variant="body2" fontWeight={500}>
            New organization
          </Typography>
        </ListItemButton>
        <Divider sx={{ my: 1 }} />
        {tenants.map((t) => (
          <Card
            key={t.id}
            variant={t.id === currentTenant?.id ? "outlined" : "elevation"}
            sx={{
              mb: 0.5,
              border: t.id === currentTenant?.id ? 2 : 0,
              borderColor: "primary.main",
            }}
          >
            <CardActionArea
              onClick={() => handleSwitchTenant(t.id)}
              disabled={switchTenantMutation.isPending}
              sx={{ p: 1.5 }}
            >
              <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                <Typography variant="body2" fontWeight={600}>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.slug}
                </Typography>
                {switchTenantMutation.isPending && t.id !== currentTenant?.id && (
                  <CircularProgress size={16} sx={{ ml: 1 }} />
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Popover>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
          mt: "64px",
          bgcolor: "background.default",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <Outlet />
      </Box>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandPaletteItems}
        onSelect={(path) => navigate(path)}
      />
      <ModalManager />
    </Box>
  );
}
