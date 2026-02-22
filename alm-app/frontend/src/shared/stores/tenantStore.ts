import { create } from "zustand";

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
  initFromStorage: () => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  currentTenant: null,
  tenants: [],
  roles: [],
  permissions: [],

  setTenant: (tenant) => {
    localStorage.setItem("current_tenant", JSON.stringify(tenant));
    set({ currentTenant: tenant });
  },

  setTenants: (tenants) => set({ tenants }),

  setRoles: (roles) => set({ roles }),

  setPermissions: (permissions) => set({ permissions }),

  clearTenant: () => {
    localStorage.removeItem("current_tenant");
    set({ currentTenant: null, roles: [], permissions: [] });
  },

  initFromStorage: () => {
    try {
      const raw = localStorage.getItem("current_tenant");
      if (raw) {
        const tenant = JSON.parse(raw) as Tenant;
        set({ currentTenant: tenant });
      }
    } catch {
      localStorage.removeItem("current_tenant");
    }
  },
}));
