import { Navigate } from "react-router-dom";
import { useTenantStore } from "../shared/stores/tenantStore";

export default function OrgRedirect() {
  const currentTenant = useTenantStore((s) => s.currentTenant);
  if (currentTenant?.slug) {
    return <Navigate to={`/${currentTenant.slug}`} replace />;
  }
  return <Navigate to="/select-tenant" replace />;
}
