import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLibraryStore } from "./libraryStore";
import { usePlaylistStore } from "./playlistStore";

export const DEFAULT_API_BASE_URL = "http://10.0.2.2:8000";
const AUTH_STORAGE_KEY = "@aura_auth_state";

export interface UserProfile {
  email: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  apiBaseUrl: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  setApiBaseUrl: (url: string) => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  syncCloudData: () => Promise<{ favoritesCount: number; playlistsCount: number } | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  isAuthenticated: false,
  isLoading: false,
  isSyncing: false,
  error: null,

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          token: parsed.token || null,
          user: parsed.user || null,
          apiBaseUrl: parsed.apiBaseUrl || DEFAULT_API_BASE_URL,
          isAuthenticated: !!parsed.token,
        });
      }
    } catch {
      // Storage failure non-fatal
    }
  },

  setApiBaseUrl: async (url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, "");
    set({ apiBaseUrl: cleanUrl });
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      data.apiBaseUrl = cleanUrl;
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage failure non-fatal
    }
  },

  clearError: () => set({ error: null }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const baseUrl = get().apiBaseUrl.replace(/\/$/, "");
    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Login failed" }));
        const msg = errData.detail || `Login failed (${response.status})`;
        set({ isLoading: false, error: msg });
        return false;
      }

      const data = await response.json();
      const token = data.access_token;
      const user = { email };

      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          token,
          user,
          apiBaseUrl: get().apiBaseUrl,
        })
      );

      // Trigger background sync after login
      void get().syncCloudData();
      return true;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.message || "Network error. Please check server URL.",
      });
      return false;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const baseUrl = get().apiBaseUrl.replace(/\/$/, "");
    try {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: "Registration failed" }));
        const msg = errData.detail || `Registration failed (${response.status})`;
        set({ isLoading: false, error: msg });
        return false;
      }

      // Automatically login after successful registration
      return await get().login(email, password);
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.message || "Network error. Please check server URL.",
      });
      return false;
    }
  },

  logout: async () => {
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      error: null,
      isSyncing: false,
    });
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Storage error non-fatal
    }
  },

  syncCloudData: async () => {
    const { token, apiBaseUrl, isAuthenticated } = get();
    if (!isAuthenticated || !token) {
      return null;
    }

    set({ isSyncing: true, error: null });
    const baseUrl = apiBaseUrl.replace(/\/$/, "");
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    try {
      // 1. Sync Favorites
      const favRes = await fetch(`${baseUrl}/favorites`, { headers });
      let favoritesCount = 0;
      if (favRes.ok) {
        const favTrackIds: number[] = await favRes.json();
        favoritesCount = favTrackIds.length;
        // Merge into local favorite store
        const currentFavs = new Set(useLibraryStore.getState().favoriteTrackIds);
        favTrackIds.forEach((id) => currentFavs.add(String(id)));
        useLibraryStore.setState({ favoriteTrackIds: currentFavs });
      }

      // 2. Sync Playlists
      const plRes = await fetch(`${baseUrl}/playlists`, { headers });
      let playlistsCount = 0;
      if (plRes.ok) {
        const remotePlaylists: Array<{ id: number; title: string }> = await plRes.json();
        playlistsCount = remotePlaylists.length;
        const currentList = usePlaylistStore.getState().playlists;
        const existingIds = new Set(currentList.map((p) => p.id));
        const merged = [...currentList];
        for (const r of remotePlaylists) {
          const strId = String(r.id);
          if (!existingIds.has(strId)) {
            merged.push({ id: strId, title: r.title });
          }
        }
        usePlaylistStore.setState({ playlists: merged });
      }

      set({ isSyncing: false });
      return { favoritesCount, playlistsCount };
    } catch (e: any) {
      set({ isSyncing: false, error: e?.message || "Sync failed" });
      return null;
    }
  },
}));
