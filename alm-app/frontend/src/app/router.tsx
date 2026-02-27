import { createBrowserRouter, useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../shared/components/ui";
import RequirePermission, {
  RequireAnyPermission,
  RequireRole,
} from "../shared/components/Layout/RequirePermission";

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="size-8 animate-spin text-muted-foreground" />
  </div>
);

const LoginPage = lazy(() => import("../features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("../features/auth/pages/RegisterPage"));
const TenantSelectorPage = lazy(
  () => import("../features/auth/pages/TenantSelectorPage"),
);
const ProtectedRoute = lazy(
  () => import("../shared/components/Layout/ProtectedRoute"),
);
const AppLayout = lazy(
  () => import("../shared/components/Layout/AppLayout"),
);
const ProjectsPage = lazy(
  () => import("../features/projects/pages/ProjectsPage"),
);
const ProjectDetailPage = lazy(
  () => import("../features/projects/pages/ProjectDetailPage"),
);
const MemberManagementPage = lazy(
  () => import("../features/settings/pages/MemberManagementPage"),
);
const RoleManagementPage = lazy(
  () => import("../features/settings/pages/RoleManagementPage"),
);
const SettingsPage = lazy(
  () => import("../features/settings/pages/SettingsPage"),
);
const PrivilegesPage = lazy(
  () => import("../features/settings/pages/PrivilegesPage"),
);
const AccessAuditPage = lazy(
  () => import("../features/settings/pages/AccessAuditPage"),
);
const ProcessManifestListPage = lazy(
  () => import("../features/settings/pages/ProcessManifestListPage"),
);
const NoAccessPage = lazy(
  () => import("../features/auth/pages/NoAccessPage"),
);
const DashboardPage = lazy(
  () => import("../features/dashboard/pages/DashboardPage"),
);
const ManifestPage = lazy(
  () => import("../features/manifest/pages/ManifestPage"),
);
const ArtifactsPage = lazy(
  () => import("../features/artifacts/pages/ArtifactsPage"),
);
const PlanningPage = lazy(
  () => import("../features/planning/pages/PlanningPage"),
);
const AutomationPage = lazy(
  () => import("../features/automation/pages/AutomationPage"),
);
const BoardPage = lazy(
  () => import("../features/board/pages/BoardPage"),
);

const OrgRedirect = lazy(() => import("./OrgRedirect"));

function ErrorFallback() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="mx-auto max-w-sm py-8 text-center">
      <h1 className="mb-2 text-2xl font-semibold">
        {is404 ? "Page Not Found" : "Something went wrong"}
      </h1>
      <p className="mb-6 text-muted-foreground">
        {is404 ? "The page you're looking for doesn't exist." : "An unexpected error occurred."}
      </p>
      <Button asChild>
        <Link to="/">Go to Dashboard</Link>
      </Button>
    </div>
  );
}

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
}

const NO_ACCESS_PATH = "/no-access";

function withPermission(
  permission: string,
  Component: ComponentType,
) {
  return (
    <RequirePermission permission={permission} fallbackTo={NO_ACCESS_PATH}>
      {withSuspense(Component)}
    </RequirePermission>
  );
}

function withAnyPermission(
  permissions: string[],
  Component: ComponentType,
) {
  return (
    <RequireAnyPermission
      permissions={permissions}
      fallbackTo={NO_ACCESS_PATH}
    >
      {withSuspense(Component)}
    </RequireAnyPermission>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    errorElement: <ErrorFallback />,
    element: withSuspense(LoginPage),
  },
  {
    path: "/register",
    element: withSuspense(RegisterPage),
  },
  {
    path: "/select-tenant",
    element: withSuspense(TenantSelectorPage),
  },
  {
    element: withSuspense(ProtectedRoute),
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: withSuspense(OrgRedirect) },
      {
        // Azure DevOps-style: /{org}/{project} e.g. /provera/Unima
        path: ":orgSlug",
        element: withSuspense(AppLayout),
        children: [
          { index: true, element: withPermission("project:read", ProjectsPage) },
          { path: "dashboard", element: withPermission("project:read", DashboardPage) },
          {
            path: "settings",
            element: withAnyPermission(
              ["tenant:read", "member:read", "role:read"],
              SettingsPage,
            ),
          },
          { path: "members", element: withPermission("member:read", MemberManagementPage) },
          {
            path: "audit",
            element: (
              <RequireRole requiredRole="admin" fallbackTo="/no-access">
                <Suspense fallback={<Loading />}>
                  <AccessAuditPage />
                </Suspense>
              </RequireRole>
            ),
          },
          { path: "roles", element: withPermission("role:read", RoleManagementPage) },
          { path: "privileges", element: withPermission("role:read", PrivilegesPage) },
          { path: "no-access", element: withSuspense(NoAccessPage) },
          {
            path: "manifest",
            element: withPermission("manifest:read", ProcessManifestListPage),
          },
          {
            path: ":projectSlug/manifest",
            element: withPermission("manifest:read", ManifestPage),
          },
          {
            path: ":projectSlug/planning",
            element: withPermission("project:read", PlanningPage),
          },
          {
            path: ":projectSlug/artifacts",
            element: withPermission("artifact:read", ArtifactsPage),
          },
          {
            path: ":projectSlug/board",
            element: withPermission("artifact:read", BoardPage),
          },
          {
            path: ":projectSlug/automation",
            element: withPermission("project:read", AutomationPage),
          },
          { path: ":projectSlug", element: withPermission("project:read", ProjectDetailPage) },
        ],
      },
    ],
  },
  {
    path: "*",
    element: (
      <div className="mx-auto max-w-sm py-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Page Not Found</h1>
        <p className="mb-6 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Button asChild>
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </div>
    ),
  },
]);
