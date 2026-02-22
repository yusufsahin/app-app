import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
  Chip,
  Popover,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  Security,
  Settings,
  Logout,
  Business,
  UnfoldMore,
} from "@mui/icons-material";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";
import { useSwitchTenant } from "../../api/authApi";
import { useNotificationStore } from "../../stores/notificationStore";
import { useQueryClient } from "@tanstack/react-query";

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", icon: <Dashboard /> },
  { label: "Members", path: "/members", icon: <People />, permission: "member:read" },
  { label: "Roles", path: "/roles", icon: <Security />, permission: "role:read" },
  { label: "Settings", path: "/settings", icon: <Settings /> },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const showNotification = useNotificationStore((s) => s.showNotification);
  const switchTenantMutation = useSwitchTenant();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [tenantAnchor, setTenantAnchor] = useState<null | HTMLElement>(null);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  );

  const handleLogout = () => {
    setUserMenuAnchor(null);
    logout();
    clearTenant();
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
      if (selected) setTenant(selected);
      queryClient.clear();
      setTenantAnchor(null);
      showNotification("Switched organization successfully");
      navigate("/");
    } catch {
      showNotification("Failed to switch organization", "error");
      setTenantAnchor(null);
    }
  };

  const userInitial = user?.display_name?.charAt(0).toUpperCase() ?? "U";

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        onClick={(e) => tenants.length > 1 ? setTenantAnchor(e.currentTarget) : undefined}
        sx={{
          p: 2,
          cursor: tenants.length > 1 ? "pointer" : "default",
          "&:hover": tenants.length > 1
            ? { bgcolor: "action.hover" }
            : undefined,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Business color="primary" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {currentTenant?.name ?? "No Organization"}
            </Typography>
            {currentTenant?.slug && (
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {currentTenant.slug}
              </Typography>
            )}
          </Box>
          {tenants.length > 1 && <UnfoldMore fontSize="small" color="action" />}
        </Box>
      </Box>

      <Divider />

      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {visibleNavItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              selected={isActive}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: isActive ? 600 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
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
            sx={{ flex: 1 }}
          >
            ALM Manifest
          </Typography>

          <Chip
            label={currentTenant?.name}
            size="small"
            variant="outlined"
            sx={{ mr: 2, display: { xs: "none", sm: "flex" } }}
          />

          <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)}>
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
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: "divider",
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
        slotProps={{ paper: { sx: { width: 240, p: 1 } } }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
          Switch organization
        </Typography>
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
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
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
