import { SettingsSubNav } from "./SettingsSubNav";

interface SettingsPageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps settings sub-pages with left sub-navigation and content area.
 * Use on Members, Roles, Privileges, Access audit, and optionally Overview.
 */
export function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  return (
    <div className="mx-auto max-w-6xl py-6">
      <div className="flex items-start">
        <SettingsSubNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
