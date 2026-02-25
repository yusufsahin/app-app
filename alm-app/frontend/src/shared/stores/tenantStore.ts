import { create } from "zustand";
import { devtools, persist, type StorageValue } from "zustand/middleware";

const TENANT_STORAGE_KEY = "current_tenant";

/** Persist current tenant using legacy key so existing sessions keep working. */
const tenantStorage = {
  getItem: (): StorageValue<{ currentTenant: Tenant | null }> | null => {
    try {
      const raw = localStorage.getItem(TENANT_STORAGE_KEY);
      if (!raw) return null;
      const currentTenant = JSON.parse(raw) as Tenant;
      return { state: { currentTenant } };
    } catch {
      return null;
    }
  },
  setItem: (_: string, value: StorageValue<{ currentTenant: Tenant | null }>) => {
    const { currentTenant } = value.state;
    if (currentTenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(currentTenant));
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  },
  removeItem: () => localStorage.removeItem(TENANT_STORAGE_KEY),
};

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier?: string;
  roles?: string[];
}

export interface TenantRole {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system: boolean;
  hierarchy_level: number;
  privileges?: string[];
}

interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  roles: TenantRole[];
  permissions: string[];
  setTenant: (tenant: Tenant) => void;
  setTenants: (tenants: Tenant[]) => void;
  setRoles: (roles: TenantRole[]) => void;
  setPermissions: (permissions: string[]) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantState>()(
  devtools(
    persist(
      (set) => ({
        currentTenant: null,
        tenants: [],
        roles: [],
        permissions: [],

        setTenant: (tenant) => set({ currentTenant: tenant }),

        setTenants: (tenants) => set({ tenants }),

        setRoles: (roles) => set({ roles }),

        setPermissions: (permissions) => set({ permissions }),

        clearTenant: () => set({ currentTenant: null, roles: [], permissions: [] }),
      }),
      {
        name: "tenant-storage",
        storage: tenantStorage,
        partialize: (s) => ({ currentTenant: s.currentTenant }),
      },
    ),
    { name: "TenantStore", enabled: import.meta.env.DEV },
  ),
);
