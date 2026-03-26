import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Building2, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, Button, Badge } from "../../../shared/components/ui";
import { useSwitchTenant } from "../../../shared/api/authApi";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import CreateOrgModal from "../components/CreateOrgModal";

interface LocationState {
  tempToken: string;
  tenants: { id: string; name: string; slug: string; tier: string }[];
}

export default function TenantSelectorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const switchTenant = useSwitchTenant();
  const setTokens = useAuthStore((s) => s.setTokens);
  const accessToken = useAuthStore((s) => s.accessToken);
  const storedTenants = useTenantStore((s) => s.tenants);
  const setTenant = useTenantStore((s) => s.setTenant);
  const setTenants = useTenantStore((s) => s.setTenants);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const state = location.state as LocationState | null;
  const tenants = state?.tenants ?? storedTenants;
  const token = state?.tempToken ?? accessToken;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleSelect = async (
    tenantId: string,
    preSelected?: { id: string; name: string; slug: string },
  ) => {
    setError(null);
    setSwitchingId(tenantId);
    try {
      const result = await switchTenant.mutateAsync({ tenantId, token });
      setTokens(result.access_token, result.refresh_token);
      const selected = preSelected ?? tenants.find((t) => t.id === tenantId);
      if (selected) {
        setTenant(selected);
        navigate(`/${selected.slug}`, { replace: true });
      }
    } catch (err: unknown) {
      const problem = err as { detail?: string; message?: string };
      setError(problem.detail ?? problem.message ?? "Failed to select organization.");
      setSwitchingId(null);
    }
  };

  const handleCreateSuccess = async (tenant: {
    id: string;
    name: string;
    slug: string;
    tier?: string;
  }) => {
    showNotification("Organization created successfully");
    setTenants([...tenants, { ...tenant, tier: tenant.tier ?? "free", roles: [] as string[] }]);
    handleSelect(tenant.id, tenant);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <h1 className="text-2xl font-semibold text-primary">ALM Manifest</h1>
      <p className="mb-4 mt-2 text-lg text-muted-foreground">Select an organization</p>

      <Button variant="outline" className="mb-6" onClick={() => setCreateModalOpen(true)}>
        <Plus className="mr-2 size-4" />
        New organization
      </Button>

      {error && (
        <div
          role="alert"
          className="mb-4 w-full max-w-[600px] rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="grid w-full max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
        {tenants.map((tenant) => (
          <Card
            key={tenant.id}
            className="h-full cursor-pointer transition-shadow hover:shadow-md data-[disabled]:pointer-events-none data-[disabled]:opacity-70"
            onClick={() => switchTenant.isPending ? undefined : handleSelect(tenant.id)}
            data-disabled={switchTenant.isPending ? true : undefined}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              {switchingId === tenant.id ? (
                <Loader2 className="mb-2 size-10 animate-spin text-primary" />
              ) : (
                <Building2 className="mb-2 size-12 text-primary" />
              )}
              <h2 className="text-lg font-semibold">{tenant.name}</h2>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
              {tenant.tier && (
                <Badge variant="secondary" className="mt-2">
                  {tenant.tier}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateOrgModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        token={token ?? undefined}
      />
    </div>
  );
}
