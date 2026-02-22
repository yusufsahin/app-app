import { create } from "zustand";

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
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  setUser: (user: User) => void;
  setRolesAndPermissions: (roles: string[], permissions: string[]) => void;
  logout: () => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  roles: [],
  permissions: [],
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },

  setRefreshToken: (refreshToken) => {
    localStorage.setItem("refresh_token", refreshToken);
    set({ refreshToken });
  },

  setUser: (user) => set({ user }),

  setRolesAndPermissions: (roles, permissions) => set({ roles, permissions }),

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("current_tenant");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,
    });
  },

  initFromStorage: () => {
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (accessToken) {
      set({ accessToken, refreshToken, isAuthenticated: true });
    }
  },
}));
