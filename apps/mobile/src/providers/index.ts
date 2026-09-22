// Re-export everything from the registry so that existing callers of
// getProvider() / getLibraryDb() continue to work without changes.
export {
  getProvider,
  getLibraryDb,
  getActiveProvider,
  setActiveProvider,
  getActiveProviderId,
  getRegisteredProviders,
  REGISTERED_PROVIDERS,
} from "./registry";
export type { ProviderId, ProviderEntry } from "./registry";
