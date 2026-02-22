import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

const Loading = () => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <CircularProgress />
  </Box>
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
const DashboardPage = lazy(
  () => import("../features/dashboard/pages/DashboardPage"),
);
const MemberManagementPage = lazy(
  () => import("../features/settings/pages/MemberManagementPage"),
);
const RoleManagementPage = lazy(
  () => import("../features/settings/pages/RoleManagementPage"),
);

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
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
    children: [
      {
        element: withSuspense(AppLayout),
        children: [
          { index: true, element: withSuspense(DashboardPage) },
          { path: "members", element: withSuspense(MemberManagementPage) },
          { path: "roles", element: withSuspense(RoleManagementPage) },
        ],
      },
    ],
  },
]);
