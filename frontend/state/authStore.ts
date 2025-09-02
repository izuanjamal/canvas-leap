import { create } from "zustand";
import backend from "~backend/client";
import type { AuthUser } from "~backend/auth/types";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  initFromStorage: () => void;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,

  initFromStorage: () => {
    try {
      const token = localStorage.getItem("cl_token");
      const userStr = localStorage.getItem("cl_user");
      if (token && userStr) {
        const user = JSON.parse(userStr) as AuthUser;
        set({ token, user });
      }
    } catch {}
  },

  setAuth: (token, user) => {
    localStorage.setItem("cl_token", token);
    localStorage.setItem("cl_user", JSON.stringify(user));
    set({ token, user });
  },

  clearAuth: () => {
    localStorage.removeItem("cl_token");
    localStorage.removeItem("cl_user");
    set({ token: null, user: null });
  },

  login: async (email, password) => {
    const resp = await backend.auth.login({ email, password });
    get().setAuth(resp.token, resp.user);
  },

  register: async (email, password, displayName) => {
    const resp = await backend.auth.register({ email, password, display_name: displayName });
    get().setAuth(resp.token, resp.user);
  },

  logout: () => {
    get().clearAuth();
    window.location.href = "/login";
  },
}));
