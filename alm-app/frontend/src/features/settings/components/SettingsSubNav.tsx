import {
  LayoutDashboard,
  Users,
  Shield,
  ShieldCheck,
  History,
  Network,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "../../../shared/stores/authStore";
import { cn } from "../../../shared/components/ui";

const NAV_ITEMS: {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}[] = [
  { path: "settings", label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  { path: "members", label: "Members", icon: <Users className="size-4" /> },
  { path: "roles", label: "Roles", icon: <Shield className="size-4" /> },
  { path: "privileges", label: "Privileges", icon: <ShieldCheck className="size-4" /> },
  { path: "manifest", label: "Process manifest", icon: <Network className="size-4" />, adminOnly: true },
  { path: "audit", label: "Access audit", icon: <History className="size-4" />, adminOnly: true },
];

export function SettingsSubNav() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="mr-6 w-[220px] shrink-0 border-r border-border pr-2"
      aria-label="Settings"
    >
      <ul className="space-y-0.5">
        {items.map((item) => {
          const fullPath = orgSlug ? `/${orgSlug}/${item.path}` : "#";
          const isActive =
            item.path === "settings"
              ? location.pathname === fullPath || location.pathname.endsWith("/settings")
              : item.path === "manifest"
                ? location.pathname === fullPath
                : location.pathname.startsWith(fullPath) || location.pathname === fullPath;

          return (
            <li key={item.path}>
              <Link
                to={fullPath}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
