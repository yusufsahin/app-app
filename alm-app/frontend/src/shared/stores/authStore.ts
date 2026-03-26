import { create } from "zustand";
import { devtools, persist, type StorageValue } from "zustand/middleware";
import { useTenantStore } from "./tenantStore";

/** Persist auth tokens using legacy keys so existing sessions keep working. */
const authStorage = {
  getItem: (): StorageValue<{ accessToken: string | null; refreshToken: string | null }> | null => {
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!accessToken) return null;
    return { state: { accessToken, refreshToken } };
  },
  setItem: (_: string, value: StorageValue<{ accessToken: string | null; refreshToken: string | null }>) => {
    const { accessToken, refreshToken } = value.state;
    if (accessToken) localStorage.setItem("access_token", accessToken);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
  },
  removeItem: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
};

export interface User {
  id: string;
  email: string;
  display_name: string;
  is_active?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  roles: string[];
  permissions: string[];
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setUser: (user: User) => void;
  setRolesAndPermissions: (roles: string[], permissions: string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        roles: [],
        permissions: [],

        setAuth: (user, accessToken, refreshToken) => {
          set({ user, accessToken, refreshToken });
        },

        setTokens: (accessToken, refreshToken) => {
          set({ accessToken, refreshToken });
        },

        setRefreshToken: (refreshToken) => {
          set({ refreshToken });
        },

        setUser: (user) => set({ user }),

        setRolesAndPermissions: (roles, permissions) =>
          set({
            roles: Array.isArray(roles) ? roles : [],
            permissions: Array.isArray(permissions) ? permissions : [],
          }),

        logout: () => {
          useTenantStore.getState().clearTenant();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            roles: [],
            permissions: [],
          });
        },
      }),
      {
        name: "auth-storage",
        storage: authStorage,
        partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
      },
    ),
    { name: "AuthStore", enabled: import.meta.env.DEV },
  ),
);
