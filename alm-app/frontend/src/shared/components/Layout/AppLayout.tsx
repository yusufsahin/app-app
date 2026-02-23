import { useState } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { Outlet, useNavigate, useLocation, useParams, useSearchParams, Navigate } from "react-router-dom";
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
  TextField,
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
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { useProjectStore } from "../../stores/projectStore";
import { useArtifactStore } from "../../stores/artifactStore";
import { useSwitchTenant } from "../../api/authApi";
import { useNotificationStore } from "../../stores/notificationStore";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "../../utils/permissions";

const DRAWER_WIDTH_EXPANDED = 260;
const DRAWER_WIDTH_COLLAPSED = 72;
const SIDEBAR_STORAGE_KEY = "alm-sidebar-collapsed";

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

export default function AppLayout() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isCollapsed = isDesktop && sidebarCollapsed;
  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;

  // OrgGuard: URL org must match current tenant (JWT is tenant-scoped)
  if (
    orgSlug &&
    currentTenant?.slug &&
    orgSlug !== currentTenant.slug
  ) {
    return <Navigate to={`/${currentTenant.slug}`} replace />;
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.permission) return hasPermission(permissions, item.permission);
    if (item.permissionAny)
      return item.permissionAny.some((p) => hasPermission(permissions, p));
    return true;
  });

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

      {visibleNavItems.some((i) =>
        (i.permissionAny ?? []).some((p) => hasPermission(permissions, p)),
      ) && (
        <>
          <Divider />
          <List sx={{ py: 0 }}>
            <ListItemButton
              onClick={() => {
                navigate(orgSlug ? `/${orgSlug}/settings` : "/");
                setMobileOpen(false);
              }}
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
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            fontWeight={600}
            color="text.primary"
            sx={{ mr: 3, display: { xs: "none", sm: "block" } }}
          >
            ALM Manifest
          </Typography>

          <TextField
            placeholder="Search projects"
            size="small"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              const next = new URLSearchParams(searchParams);
              if (q) next.set("q", q);
              else next.delete("q");
              setSearchParams(next, { replace: true });
            }}
            sx={{
              flex: 1,
              maxWidth: 360,
              display: { xs: "none", md: "block" },
              "& .MuiOutlinedInput-root": {
                bgcolor: "action.hover",
                "& fieldset": { borderColor: "transparent" },
              },
            }}
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
    </Box>
  );
}
