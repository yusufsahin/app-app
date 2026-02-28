import { useState, useEffect, useMemo } from "react";
import { Outlet, useNavigate, useLocation, useParams, Navigate, Link } from "react-router-dom";
import {
  Folder,
  LayoutDashboard,
  FolderOpen,
  Calendar,
  List,
  Columns,
  Sparkles,
  Settings,
  LogOut,
  Plus,
  Bell,
  Search,
  Network,
  History,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "../ui";
import { Button, Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, Card, CardContent, Separator } from "../ui";
import { useAuthStore } from "../../stores/authStore";
import { useOrgProjects } from "../../api/orgApi";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { CommandPalette } from "./CommandPalette";
import type { CommandPaletteItem, CommandPaletteGroup } from "./CommandPalette";
import { useTenantStore } from "../../stores/tenantStore";
import { useProjectStore } from "../../stores/projectStore";
import { useArtifactStore } from "../../stores/artifactStore";
import { useSwitchTenant } from "../../api/authApi";
import { ModalManager } from "../../modal";
import { useNotificationStore } from "../../stores/notificationStore";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "../../utils/permissions";
import { useRealtime } from "../../realtime/useRealtime";
import { ThemeToggle } from "../../../app/theme/ThemeToggle";
import CreateProjectModal from "../../../features/projects/components/CreateProjectModal";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  permissionAny?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Projects", path: "", icon: <Folder className="size-4" />, permission: "project:read" },
  { label: "Dashboard", path: "dashboard", icon: <LayoutDashboard className="size-4" />, permission: "project:read" },
];

const PROJECT_NAV_ITEMS: NavItem[] = [
  { label: "Overview", path: "", icon: <FolderOpen className="size-4" />, permission: "project:read" },
  { label: "Artifacts", path: "artifacts", icon: <List className="size-4" />, permission: "artifact:read" },
  { label: "Board", path: "board", icon: <Columns className="size-4" />, permission: "artifact:read" },
  { label: "Planning", path: "planning", icon: <Calendar className="size-4" />, permission: "project:read" },
  { label: "Automation", path: "automation", icon: <Sparkles className="size-4" />, permission: "project:read" },
];

export default function AppLayout() {
  useRealtime();
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const { data: projects = [] } = useOrgProjects(orgSlug);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setLastVisitedProjectSlug = useProjectStore((s) => s.setLastVisitedProjectSlug);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);
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

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tenantPopoverOpen, setTenantPopoverOpen] = useState(false);
  const createModalOpen = useProjectStore((s) => s.listState.createModalOpen);
  const setCreateModalOpen = useProjectStore((s) => s.setCreateModalOpen);

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

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.permission) return hasPermission(permissions, item.permission);
    if (item.permissionAny) return item.permissionAny.some((p) => hasPermission(permissions, p));
    return true;
  });

  const lastVisitedProjectSlug = useProjectStore((s) => s.lastVisitedProjectSlug);

  const commandPaletteGroups: CommandPaletteGroup[] = useMemo(() => {
    if (!orgSlug) return [];
    const groups: CommandPaletteGroup[] = [];

    const recentProjects: CommandPaletteItem[] = [];
    if (projects.length > 0) {
      const sorted = [...projects].sort((a, b) => {
        if (lastVisitedProjectSlug === a.slug) return -1;
        if (lastVisitedProjectSlug === b.slug) return 1;
        return 0;
      });
      for (const p of sorted.slice(0, 5)) {
        recentProjects.push({
          id: `recent-${p.slug}`,
          label: p.name ?? p.slug,
          path: `/${orgSlug}/${p.slug}`,
          icon: <FolderOpen className="size-4" />,
        });
      }
      if (recentProjects.length > 0) {
        groups.push({ group: "Recent projects", items: recentProjects });
      }
    }

    if (projectSlug) {
      const quickLinks: CommandPaletteItem[] = [];
      const artifactRead = hasPermission(permissions, "artifact:read");
      const projectRead = hasPermission(permissions, "project:read");
      if (artifactRead) {
        quickLinks.push({ id: "goto-artifacts", label: "Go to Artifacts", path: `/${orgSlug}/${projectSlug}/artifacts`, icon: <List className="size-4" /> });
        quickLinks.push({ id: "goto-board", label: "Go to Board", path: `/${orgSlug}/${projectSlug}/board`, icon: <Columns className="size-4" /> });
      }
      if (projectRead) {
        quickLinks.push({ id: "goto-planning", label: "Go to Planning", path: `/${orgSlug}/${projectSlug}/planning`, icon: <Calendar className="size-4" /> });
      }
      if (quickLinks.length > 0) {
        groups.push({ group: "Quick links", items: quickLinks });
      }
    }

    const pages: CommandPaletteItem[] = [];
    for (const item of visibleNavItems) {
      const path = item.path ? `/${orgSlug}/${item.path}` : `/${orgSlug}`;
      pages.push({ id: item.path || "projects", label: item.label, path, icon: item.icon });
    }
    if (projectSlug) {
      const projectItems = PROJECT_NAV_ITEMS.filter((item) => {
        if (item.permission) return hasPermission(permissions, item.permission);
        if (item.permissionAny) return item.permissionAny.some((p) => hasPermission(permissions, p));
        return true;
      });
      for (const item of projectItems) {
        const path = item.path ? `/${orgSlug}/${projectSlug}/${item.path}` : `/${orgSlug}/${projectSlug}`;
        pages.push({ id: `proj-${item.path || "overview"}`, label: item.label, path, icon: item.icon });
      }
    }
    if (hasPermission(permissions, "tenant:read") || hasPermission(permissions, "member:read") || hasPermission(permissions, "role:read")) {
      pages.push({ id: "settings", label: "Organization settings", path: `/${orgSlug}/settings`, icon: <Settings className="size-4" /> });
    }
    if (isAdmin) {
      pages.push({ id: "audit", label: "Access audit", path: `/${orgSlug}/audit`, icon: <History className="size-4" /> });
    }
    if (pages.length > 0) {
      groups.push({ group: "Pages", items: pages });
    }
    return groups;
  }, [orgSlug, projectSlug, visibleNavItems, permissions, isAdmin, projects, lastVisitedProjectSlug]);

  const commandPaletteItems: CommandPaletteItem[] = useMemo(() => {
    return commandPaletteGroups.flatMap((g) => g.items);
  }, [commandPaletteGroups]);

  if (orgSlug && currentTenant?.slug && orgSlug !== currentTenant.slug) {
    return <Navigate to={`/${currentTenant.slug}`} replace />;
  }

  const handleLogout = () => {
    logout();
    clearTenant();
    clearProjectStore();
    clearArtifactStore();
    queryClient.clear();
    navigate("/login");
  };

  const handleSwitchTenant = async (tenantId: string) => {
    if (!accessToken || tenantId === currentTenant?.id) return;
    try {
      const result = await switchTenantMutation.mutateAsync({ tenantId, token: accessToken });
      setTokens(result.access_token, result.refresh_token);
      const selected = tenants.find((t) => t.id === tenantId);
      if (selected) {
        setTenant(selected);
        useProjectStore.getState().clearCurrentProject();
        useArtifactStore.getState().clearAll();
        navigate(`/${selected.slug}`);
      }
      queryClient.clear();
      setTenantPopoverOpen(false);
      showNotification("Switched organization successfully");
    } catch {
      showNotification("Failed to switch organization", "error");
    }
  };

  const userInitial = user?.display_name?.charAt(0).toUpperCase() ?? "U";
  const isOrgHome = !!orgSlug && !projectSlug && (location.pathname === `/${orgSlug}` || location.pathname === `/${orgSlug}/`);
  const canCreateProject = hasPermission(permissions, "project:create");
  const settingsPermission = hasPermission(permissions, "tenant:read") || hasPermission(permissions, "member:read") || hasPermission(permissions, "role:read");

  const projectNavItems = PROJECT_NAV_ITEMS.filter((item) => {
    if (item.permission) return hasPermission(permissions, item.permission);
    if (item.permissionAny) return item.permissionAny.some((p) => hasPermission(permissions, p));
    return true;
  });

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <Popover open={tenantPopoverOpen} onOpenChange={setTenantPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md p-2 text-left outline-none hover:bg-sidebar-accent"
                aria-label="Switch organization"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Network className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{currentTenant?.name ?? "ALM"}</p>
                  <p className="truncate text-xs text-muted-foreground">Management Suite</p>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <p className="mb-2 px-2 text-xs text-muted-foreground">Switch organization</p>
              <Button variant="ghost" className="w-full justify-start" asChild>
                <Link to="/select-tenant" onClick={() => setTenantPopoverOpen(false)}>
                  <Plus className="mr-2 size-4" />
                  New organization
                </Link>
              </Button>
              <Separator className="my-2" />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {tenants.map((t) => (
                  <Card
                    key={t.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${t.id === currentTenant?.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => handleSwitchTenant(t.id)}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.slug}</p>
                      {switchTenantMutation.isPending && t.id !== currentTenant?.id && (
                        <span className="text-xs">Switching…</span>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                const basePath = orgSlug ? `/${orgSlug}` : "";
                const fullPath = item.path ? `${basePath}/${item.path}` : basePath || "/";
                const isActive = item.path === ""
                  ? location.pathname === basePath || location.pathname === `${basePath}/`
                  : location.pathname.startsWith(`${basePath}/${item.path}`);
                return (
                  <SidebarMenuItem key={item.path || "projects"}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={fullPath}>{item.icon}<span>{item.label}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>

          {projectSlug && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupLabel>Project</SidebarGroupLabel>
                <ProjectSwitcher onNavigate={() => {}} />
                <SidebarMenu>
                  {projectNavItems.map((item) => {
                    const basePath = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "";
                    const fullPath = item.path ? `${basePath}/${item.path}` : basePath;
                    const isActive = item.path === ""
                      ? location.pathname === basePath || location.pathname === `${basePath}/`
                      : location.pathname.startsWith(`${basePath}/${item.path}`);
                    return (
                      <SidebarMenuItem key={item.path || "overview"}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                          <Link to={fullPath}>{item.icon}<span>{item.label}</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </>
          )}

          {settingsPermission && (
            <>
              <SidebarSeparator />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === `/${orgSlug}/settings` || location.pathname.startsWith(`/${orgSlug}/settings/`)} tooltip="Organization settings">
                    <Link to={orgSlug ? `/${orgSlug}/settings` : "/"}>
                      <Settings className="size-4" />
                      <span>Organization settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg p-2 outline-none hover:bg-sidebar-accent"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{user?.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive" variant="destructive">
                <LogOut className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex justify-center p-1">
            <SidebarTrigger />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="md:hidden" />
          <Link
            to={orgSlug ? `/${orgSlug}` : "/"}
            className="hidden items-center gap-2 md:flex"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Network className="size-4" />
            </div>
            <span className="font-semibold">ALM</span>
          </Link>
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted sm:flex max-w-[400px] flex-1"
          >
            <Search className="size-4" />
            <span>Search</span>
            <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline-block">
              {typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} K
            </kbd>
          </button>
          <span className="flex-1 md:hidden" />
          <div className="flex items-center gap-1">
            {isOrgHome && canCreateProject && (
              <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 size-4" />
                New project
              </Button>
            )}
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            <Button variant="ghost" size="icon" className="size-9" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9" aria-label="Settings" onClick={() => navigate(orgSlug ? `/${orgSlug}/settings` : "/")}>
              <Settings className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium">{user?.display_name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/30 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandPaletteItems}
        groups={commandPaletteGroups}
        onSelect={(path) => navigate(path)}
        placeholder="Search or jump to…"
        description="Search pages, projects, or go to Artifacts…"
      />
      {orgSlug && (
        <CreateProjectModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          orgSlug={orgSlug}
        />
      )}
      <ModalManager />
    </SidebarProvider>
  );
}
