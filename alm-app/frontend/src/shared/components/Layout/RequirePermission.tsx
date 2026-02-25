import { type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { hasPermission } from "../../utils/permissions";

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
  fallbackTo?: string;
}

/**
 * Wraps content that requires a specific permission.
 * Redirects to fallbackTo (default "/") if user lacks permission.
 * When used under /:orgSlug, fallback "no-access" resolves to /{orgSlug}/no-access.
 */
export default function RequirePermission({
  permission,
  children,
  fallbackTo = "/",
}: RequirePermissionProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const allowed = hasPermission(permissions, permission);

  if (!allowed) {
    const target =
      fallbackTo === "/no-access" && orgSlug ? `/${orgSlug}/no-access` : fallbackTo;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

interface RequireAnyPermissionProps {
  permissions: string[];
  children: ReactNode;
  fallbackTo?: string;
}

/**
 * Wraps content that requires ANY of the given permissions.
 */
export function RequireAnyPermission({
  permissions: required,
  children,
  fallbackTo = "/",
}: RequireAnyPermissionProps) {
  const userPermissions = useAuthStore((s) => s.permissions);
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const allowed = required.some((p) => hasPermission(userPermissions, p));

  if (!allowed) {
    const target =
      fallbackTo === "/no-access" && orgSlug ? `/${orgSlug}/no-access` : fallbackTo;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  requiredRole: string;
  children: ReactNode;
  fallbackTo?: string;
}

/**
 * Wraps content that requires a specific role (e.g. "admin").
 */
export function RequireRole({
  requiredRole,
  children,
  fallbackTo = "/",
}: RequireRoleProps) {
  const roles = useAuthStore((s) => s.roles);
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const allowed = roles.includes(requiredRole);

  if (!allowed) {
    const target =
      fallbackTo === "/no-access" && orgSlug ? `/${orgSlug}/no-access` : fallbackTo;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
