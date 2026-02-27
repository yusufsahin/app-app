import { useState } from "react";
import { Archive, Building2 } from "lucide-react";
import { apiClient } from "../../../shared/api/client";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";
import { Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shared/components/ui";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const isAdmin = roles.includes("admin");

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const clearTenant = useTenantStore((s) => s.clearTenant);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const handleArchiveOrg = async () => {
    if (!currentTenant?.id) return;
    setArchiving(true);
    try {
      await apiClient.delete(`/tenants/${currentTenant.id}`);
      showNotification("Organization archived");
      clearTenant();
      setArchiveDialogOpen(false);
      navigate("/select-tenant", { replace: true });
    } catch (err: unknown) {
      const problem = err as { detail?: string };
      showNotification(problem.detail ?? "Failed to archive organization", "error");
    } finally {
      setArchiving(false);
    }
  };

  return (
    <SettingsPageWrapper>
      <OrgSettingsBreadcrumbs currentPageLabel="Overview" />
      <h1 className="mb-4 text-2xl font-semibold">Organization settings</h1>

      <Card className="mb-6 max-w-[560px] border border-border">
        <CardContent>
          <p className="mb-4 flex items-center gap-2 font-semibold">
            <Building2 className="size-4" />
            General
          </p>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="font-medium">{currentTenant?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Slug</p>
              <p className="font-mono text-sm">{currentTenant?.slug ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tier</p>
              <Badge variant="outline" className="mt-1">
                {currentTenant?.tier ?? "—"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="max-w-[560px]">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Danger zone</h2>
          <Card className="border border-destructive/50">
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Archiving this organization will soft-delete it. Only admins can archive. You will
                be redirected to tenant selection.
              </p>
              <Button
                variant="destructive"
                onClick={() => setArchiveDialogOpen(true)}
              >
                <Archive className="mr-2 size-4" />
                Archive organization
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={archiveDialogOpen} onOpenChange={(open) => !archiving && setArchiveDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive organization?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will archive the current organization. You will need to select another organization
            or log out. This action can be reversed by a system administrator. Continue?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchiveOrg} disabled={archiving}>
              {archiving ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPageWrapper>
  );
}
