import type { MusicProvider } from "@aura/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openLibrary } from "../library/database";
import { createLocalProvider } from "../library/localProvider";
import { InternetArchiveProvider } from "@aura/shared";

// ---------------------------------------------------------------------------
// Provider IDs
// ---------------------------------------------------------------------------

export type ProviderId = "local" | "internet-archive";

export interface ProviderEntry {
  id: ProviderId;
  name: string;
  description: string;
}

export const REGISTERED_PROVIDERS: ProviderEntry[] = [
  {
    id: "local",
    name: "Local Library",
    description: "Your own music files on this device",
  },
  {
    id: "internet-archive",
    name: "Internet Archive",
    description: "Free, open, legally streamable recordings from archive.org",
  },
];

const STORAGE_KEY = "aura.activeProviderId";
const DEFAULT_PROVIDER_ID: ProviderId = "local";

// ---------------------------------------------------------------------------
// Lazy singletons — one instance per provider, created on first use
// ---------------------------------------------------------------------------

let localProviderPromise: Promise<MusicProvider> | null = null;
let iaProvider: MusicProvider | null = null;

function getLocalProvider(): Promise<MusicProvider> {
  if (!localProviderPromise) {
    localProviderPromise = openLibrary().then(createLocalProvider);
  }
  return localProviderPromise;
}

function getIAProvider(): MusicProvider {
  if (!iaProvider) {
    iaProvider = new InternetArchiveProvider(fetch);
  }
  return iaProvider;
}

// ---------------------------------------------------------------------------
// Active provider — persisted to AsyncStorage
// ---------------------------------------------------------------------------

let _cachedActiveId: ProviderId | null = null;

/**
 * Returns the currently selected provider.
 * Reads from AsyncStorage once then caches in memory.
 */
export async function getActiveProvider(): Promise<MusicProvider> {
  if (!_cachedActiveId) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      _cachedActiveId =
        stored === "internet-archive" ? "internet-archive" : DEFAULT_PROVIDER_ID;
    } catch {
      _cachedActiveId = DEFAULT_PROVIDER_ID;
    }
  }

  if (_cachedActiveId === "internet-archive") return getIAProvider();
  return getLocalProvider();
}

/**
 * Sets the active provider and persists the selection.
 * The next call to `getActiveProvider()` will return the new provider.
 */
export async function setActiveProvider(id: ProviderId): Promise<void> {
  _cachedActiveId = id;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Non-fatal; the in-memory cache still takes effect for this session.
  }
}

export function getActiveProviderId(): ProviderId {
  return _cachedActiveId ?? DEFAULT_PROVIDER_ID;
}

export function getRegisteredProviders(): ProviderEntry[] {
  return REGISTERED_PROVIDERS;
}

// ---------------------------------------------------------------------------
// Legacy compatibility — apps/mobile/src/providers/index.ts used to export
// getLibraryDb() and getProvider() directly. We keep them for callers that
// haven't been updated yet.
// ---------------------------------------------------------------------------

export function getLibraryDb() {
  return openLibrary();
}

/** @deprecated Prefer getActiveProvider() */
export async function getProvider(): Promise<MusicProvider> {
  return getActiveProvider();
}
