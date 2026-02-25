import { List, ListItemButton, ListItemIcon, ListItemText, Box } from "@mui/material";
import {
  Dashboard,
  People,
  Security,
  VerifiedUser,
  History,
  AccountTree,
} from "@mui/icons-material";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "../../../shared/stores/authStore";

const NAV_ITEMS: { path: string; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { path: "settings", label: "Overview", icon: <Dashboard /> },
  { path: "members", label: "Members", icon: <People /> },
  { path: "roles", label: "Roles", icon: <Security /> },
  { path: "privileges", label: "Privileges", icon: <VerifiedUser /> },
  { path: "manifest", label: "Process manifest", icon: <AccountTree />, adminOnly: true },
  { path: "audit", label: "Access audit", icon: <History />, adminOnly: true },
];

export function SettingsSubNav() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: 1,
        borderColor: "divider",
        pr: 1,
        mr: 3,
      }}
    >
      <List dense disablePadding>
        {items.map((item) => {
          const fullPath = orgSlug ? `/${orgSlug}/${item.path}` : "#";
          const isActive =
            item.path === "settings"
              ? location.pathname === fullPath || location.pathname.endsWith("/settings")
              : item.path === "manifest"
                ? location.pathname === fullPath
                : location.pathname.startsWith(fullPath) || location.pathname === fullPath;

          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={fullPath}
              selected={isActive}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                  "& .MuiListItemIcon-root": { color: "inherit" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ variant: "body2" }} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
