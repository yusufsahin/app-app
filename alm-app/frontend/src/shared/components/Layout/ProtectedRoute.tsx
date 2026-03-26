import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "../../api/authApi";
import { useMyTenants } from "../../api/tenantApi";
import { useAuthStore } from "../../stores/authStore";
import { useTenantStore } from "../../stores/tenantStore";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const setRolesAndPermissions = useAuthStore((s) => s.setRolesAndPermissions);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setTenants = useTenantStore((s) => s.setTenants);

  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
  } = useCurrentUser();

  const {
    data: tenants,
    isLoading: tenantsLoading,
    isError: tenantsError,
  } = useMyTenants();

  useEffect(() => {
    if (user) {
      setUser({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_active: user.is_active,
      });
      setRolesAndPermissions(user.roles, user.permissions);
    }
  }, [user, setUser, setRolesAndPermissions]);

  useEffect(() => {
    if (tenants) {
      setTenants(tenants);
      if (!currentTenant && tenants.length === 1) {
        setTenant(tenants[0]!);
      }
    }
  }, [tenants, currentTenant, setTenants, setTenant]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (userError || tenantsError) {
    logout();
    return <Navigate to="/login" replace />;
  }

  if (userLoading || tenantsLoading) {
    return <Loading />;
  }

  if (!currentTenant && tenants && tenants.length > 1) {
    return <Navigate to="/select-tenant" replace />;
  }

  if (!currentTenant) {
    return <Loading />;
  }

  return <Outlet />;
}
