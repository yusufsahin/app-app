import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { TenantListItem } from '../types/api';

const ACCESS_KEY = 'alm_access_token';
const REFRESH_KEY = 'alm_refresh_token';
const GATE_TEMP_KEY = 'alm_switch_temp_token';
const GATE_TENANTS_KEY = 'alm_login_tenant_options_json';
const WORKSPACE_KEY = 'alm_workspace_json';

async function flushWorkspaceToSecure(get: () => SessionState) {
  const { tenantId, orgSlug, orgName, projectId, projectName } = get();
  if (!tenantId || !orgSlug) {
    await saveSecure(WORKSPACE_KEY, null);
    return;
  }
  await saveSecure(
    WORKSPACE_KEY,
    JSON.stringify({
      tenant_id: tenantId,
      org_slug: orgSlug,
      org_name: orgName,
      project_id: projectId,
      project_name: projectName,
    }),
  );
}

function parseWorkspace(
  raw: string | null,
): {
  tenantId: string;
  orgSlug: string;
  orgName: string | null;
  projectId: string | null;
  projectName: string | null;
} | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.tenant_id !== 'string' || typeof o.org_slug !== 'string') return null;
    if (!o.tenant_id || !o.org_slug) return null;
    return {
      tenantId: o.tenant_id,
      orgSlug: o.org_slug,
      orgName: typeof o.org_name === 'string' ? o.org_name : null,
      projectId: typeof o.project_id === 'string' && o.project_id.length > 0 ? o.project_id : null,
      projectName: typeof o.project_name === 'string' ? o.project_name : null,
    };
  } catch {
    return null;
  }
}

function parseStoredTenantOptions(raw: string | null): TenantListItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: TenantListItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.slug !== 'string') return null;
      out.push({
        id: o.id,
        name: o.name,
        slug: o.slug,
        tier: typeof o.tier === 'string' ? o.tier : '',
        roles:
          Array.isArray(o.roles) && o.roles.every((r) => typeof r === 'string') ? (o.roles as string[]) : [],
      });
    }
    return out;
  } catch {
    return null;
  }
}

export interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  orgSlug: string | null;
  orgName: string | null;
  projectId: string | null;
  projectName: string | null;
  hydrated: boolean;
  /** After login when `requires_tenant_selection` — use with `switchTenant`. */
  switchTempToken: string | null;
  loginTenantOptions: TenantListItem[] | null;
  setLoginTenantGate: (tempToken: string | null, tenants: TenantListItem[] | null) => Promise<void>;
  setTokens: (access: string | null, refresh?: string | null) => Promise<void>;
  setOrg: (tenantId: string | null, slug: string | null, name?: string | null) => Promise<void>;
  setProject: (id: string | null, name?: string | null) => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
  /** Clears access/refresh and persisted workspace (org/project); keeps tenant-selection gate until replaced. */
  clearAuthTokens: () => Promise<void>;
  logout: () => Promise<void>;
}

async function saveSecure(key: string, value: string | null) {
  if (value == null || value === '') {
    await SecureStore.deleteItemAsync(key);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  tenantId: null,
  orgSlug: null,
  orgName: null,
  projectId: null,
  projectName: null,
  hydrated: false,
  switchTempToken: null,
  loginTenantOptions: null,

  setLoginTenantGate: async (tempToken, tenants) => {
    set({ switchTempToken: tempToken, loginTenantOptions: tenants });
    if (tempToken && tenants?.length) {
      await saveSecure(GATE_TEMP_KEY, tempToken);
      await saveSecure(GATE_TENANTS_KEY, JSON.stringify(tenants));
    } else {
      await saveSecure(GATE_TEMP_KEY, null);
      await saveSecure(GATE_TENANTS_KEY, null);
    }
  },

  setTokens: async (access, refresh) => {
    await saveSecure(ACCESS_KEY, access);
    if (refresh !== undefined) await saveSecure(REFRESH_KEY, refresh);
    set({
      accessToken: access,
      refreshToken: refresh !== undefined ? refresh : get().refreshToken,
    });
  },

  setOrg: async (tid, slug, name) => {
    if (tid == null || slug == null) {
      set({
        tenantId: null,
        orgSlug: null,
        orgName: null,
        projectId: null,
        projectName: null,
      });
      await saveSecure(WORKSPACE_KEY, null);
      return;
    }
    set({ tenantId: tid, orgSlug: slug, orgName: name ?? null });
    await flushWorkspaceToSecure(get);
  },

  setProject: async (id, name) => {
    set({ projectId: id, projectName: name ?? null });
    await flushWorkspaceToSecure(get);
  },

  hydrateFromStorage: async () => {
    try {
      const [access, refresh, gateTemp, tenantsRaw, workspaceRaw] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(GATE_TEMP_KEY),
        SecureStore.getItemAsync(GATE_TENANTS_KEY),
        SecureStore.getItemAsync(WORKSPACE_KEY),
      ]);
      const tenantsParsed = parseStoredTenantOptions(tenantsRaw);
      let switchTempToken: string | null = null;
      let loginTenantOptions: TenantListItem[] | null = null;
      if (gateTemp && tenantsParsed?.length) {
        switchTempToken = gateTemp;
        loginTenantOptions = tenantsParsed;
        await saveSecure(WORKSPACE_KEY, null);
      } else if (gateTemp || tenantsRaw) {
        await saveSecure(GATE_TEMP_KEY, null);
        await saveSecure(GATE_TENANTS_KEY, null);
      }

      let tenantId: string | null = null;
      let orgSlug: string | null = null;
      let orgName: string | null = null;
      let projectId: string | null = null;
      let projectName: string | null = null;
      if (!switchTempToken) {
        const ws = parseWorkspace(workspaceRaw);
        if (ws) {
          tenantId = ws.tenantId;
          orgSlug = ws.orgSlug;
          orgName = ws.orgName;
          projectId = ws.projectId;
          projectName = ws.projectName;
        } else if (workspaceRaw) {
          await saveSecure(WORKSPACE_KEY, null);
        }
      }

      set({
        accessToken: access,
        refreshToken: refresh,
        switchTempToken,
        loginTenantOptions,
        tenantId,
        orgSlug,
        orgName,
        projectId,
        projectName,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  clearAuthTokens: async () => {
    await saveSecure(ACCESS_KEY, null);
    await saveSecure(REFRESH_KEY, null);
    await saveSecure(WORKSPACE_KEY, null);
    set({
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      orgSlug: null,
      orgName: null,
      projectId: null,
      projectName: null,
    });
  },

  logout: async () => {
    await saveSecure(ACCESS_KEY, null);
    await saveSecure(REFRESH_KEY, null);
    await saveSecure(GATE_TEMP_KEY, null);
    await saveSecure(GATE_TENANTS_KEY, null);
    await saveSecure(WORKSPACE_KEY, null);
    set({
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      orgSlug: null,
      orgName: null,
      projectId: null,
      projectName: null,
      switchTempToken: null,
      loginTenantOptions: null,
    });
  },
}));
