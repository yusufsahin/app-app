import { Ban } from "lucide-react";
import { Button } from "../../../shared/components/ui";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";

export default function NoAccessPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const permissions = useAuthStore((s) => s.permissions);
  const canViewProjects = hasPermission(permissions, "project:read");

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="mx-auto max-w-sm py-8 text-center">
      <Ban className="mx-auto mb-4 size-16 text-destructive" />
      <h1 className="mb-2 text-xl font-semibold">
        Access Denied
      </h1>
      <p className="mb-6 text-muted-foreground">
        You don&apos;t have permission to view this page.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {canViewProjects && (
          <Button onClick={() => navigate("/")}>
            Go to Projects
          </Button>
        )}
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
