import { Link, useParams } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui";
import { useTenantStore } from "../../stores/tenantStore";

export interface OrgSettingsBreadcrumbsProps {
  currentPageLabel: string;
}

/**
 * Breadcrumbs for organization-level settings: Org > Organization settings > [Page].
 */
export function OrgSettingsBreadcrumbs({ currentPageLabel }: OrgSettingsBreadcrumbsProps) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const orgDisplayName = currentTenant?.name ?? orgSlug ?? "Organization";
  const orgPath = orgSlug ? `/${orgSlug}` : "#";
  const settingsPath = orgSlug ? `/${orgSlug}/settings` : "#";

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={orgPath}>{orgDisplayName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={settingsPath}>Organization settings</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
