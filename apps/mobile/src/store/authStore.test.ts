jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: jest.fn(async (key: string): Promise<string | null> => {
      return store[key] ?? null;
    }),
    setItem: jest.fn(async (key: string, value: string): Promise<void> => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string): Promise<void> => {
      delete store[key];
    }),
    clear: jest.fn(async (): Promise<void> => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
  return {
    __esModule: true,
    default: mockStorage,
    ...mockStorage,
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore, DEFAULT_API_BASE_URL } from "./authStore";
import { useLibraryStore } from "./libraryStore";
import { usePlaylistStore } from "./playlistStore";

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("useAuthStore", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({
      token: null,
      user: null,
      apiBaseUrl: DEFAULT_API_BASE_URL,
      isAuthenticated: false,
      isLoading: false,
      isSyncing: false,
      error: null,
    });
    useLibraryStore.setState({ favoriteTrackIds: new Set() });
    usePlaylistStore.setState({ playlists: [] });
  });

  it("handles successful login and saves state to AsyncStorage", async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/login")) {
        return makeResponse({ access_token: "jwt.access.123" });
      }
      if (url.includes("/favorites")) {
        return makeResponse([1, 2]);
      }
      if (url.includes("/playlists")) {
        return makeResponse([{ id: 10, title: "Cloud Lounge" }]);
      }
      return makeResponse({}, 404);
    }) as any;

    const ok = await useAuthStore.getState().login("audiophile@aura.io", "Pass#1234");
    expect(ok).toBe(true);
    expect(useAuthStore.getState().token).toBe("jwt.access.123");
    expect(useAuthStore.getState().user?.email).toBe("audiophile@aura.io");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    const stored = await AsyncStorage.getItem("@aura_auth_state");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).token).toBe("jwt.access.123");
  });

  it("handles login failure with error message", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeResponse({ detail: "Invalid email or password" }, 401)
    ) as any;

    const ok = await useAuthStore.getState().login("wrong@aura.io", "badpass");
    expect(ok).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe("Invalid email or password");
  });

  it("handles registration followed by auto-login", async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/register")) {
        return makeResponse({ status: "registered" }, 201);
      }
      if (url.includes("/auth/login")) {
        return makeResponse({ access_token: "new.user.jwt" });
      }
      if (url.includes("/favorites") || url.includes("/playlists")) {
        return makeResponse([]);
      }
      return makeResponse({}, 404);
    }) as any;

    const ok = await useAuthStore.getState().register("new@aura.io", "Secure#999");
    expect(ok).toBe(true);
    expect(useAuthStore.getState().token).toBe("new.user.jwt");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("syncs favorites and playlists into local stores", async () => {
    useAuthStore.setState({
      token: "test.token",
      isAuthenticated: true,
    });

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes("/favorites")) {
        return makeResponse([42, 99]);
      }
      if (url.includes("/playlists")) {
        return makeResponse([{ id: 5, title: "Ambient Echoes" }]);
      }
      return makeResponse({}, 404);
    }) as any;

    const result = await useAuthStore.getState().syncCloudData();
    expect(result).toEqual({ favoritesCount: 2, playlistsCount: 1 });

    const favs = useLibraryStore.getState().favoriteTrackIds;
    expect(favs.has("42")).toBe(true);
    expect(favs.has("99")).toBe(true);

    const playlists = usePlaylistStore.getState().playlists;
    expect(playlists.some((p) => p.id === "5" && p.title === "Ambient Echoes")).toBe(true);
  });

  it("logs out and clears persisted state", async () => {
    useAuthStore.setState({
      token: "existing.token",
      user: { email: "user@aura.io" },
      isAuthenticated: true,
    });
    await AsyncStorage.setItem(
      "@aura_auth_state",
      JSON.stringify({ token: "existing.token", user: { email: "user@aura.io" } })
    );

    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();

    const stored = await AsyncStorage.getItem("@aura_auth_state");
    expect(stored).toBeNull();
  });
});
