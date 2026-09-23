# AURA — Phase 10 Design: Aura Cloud Provider, Cloud Library Sync & Authentication

Date: 2026-09-23
Status: Approved

## Purpose

With the FastAPI backend now connected to the production Supabase PostgreSQL database, Phase 10 connects the AURA mobile app directly to the cloud backend. This gives users seamless access to cloud-hosted lossless music streaming, remote search, and real-time synchronization of favorites, playlists, and play history.

## Architecture & Components

### 1. Aura Cloud Music Provider (`AuraCloudProvider`)
- Implements the standard `MusicProvider` interface from `@aura/shared`:
  - `id`: `"aura-cloud"`
  - `search(query)`: Queries `/search?q={query}` to retrieve remote artists, albums, and tracks.
  - `getArtist(id)`: Queries `/artists/{id}`.
  - `getAlbum(id)`: Queries `/albums/{id}`.
  - `getTrack(id)`: Queries `/tracks/{id}`.
  - `getPlaylist(id)`: Queries `/playlists/{id}`.
  - `getRecommendations(seed)`: Queries `/recommendations?seed_track_id={seed}`.
  - `getPlaybackSource(trackId)`: Generates lossless stream URL with Bearer token authentication header:
    `{ uri: "${apiBaseUrl}/stream/${trackId}", headers: { Authorization: "Bearer ${token}" } }`.

### 2. Authentication & Cloud Sync Store (`useAuthStore`)
- Zustand store persisted in `@react-native-async-storage/async-storage` (`@aura_auth_state`):
  - State: `user`, `token`, `apiBaseUrl` (configurable default `http://10.0.2.2:8000` / `http://localhost:8000`), `isSyncing`, `error`.
  - Actions:
    - `login(email, password)`: Calls `/auth/login` to obtain access token.
    - `register(email, password)`: Calls `/auth/register` and auto-logs in.
    - `logout()`: Clears credentials and active cloud sessions.
    - `setApiBaseUrl(url)`: Allows user to configure the backend host IP or domain.
    - `syncCloudData()`: Bidirectional sync of favorites and playlists between mobile stores and the Supabase backend.

### 3. Provider Registry Update (`registry.ts`)
- Add `aura-cloud` to `REGISTERED_PROVIDERS`:
  ```typescript
  {
    id: "aura-cloud",
    name: "Aura Cloud (Supabase)",
    description: "Cloud-hosted Hi-Res Lossless streaming & synced library",
  }
  ```
- Wire lazy instantiation linking `AuraCloudProvider` with the active `apiBaseUrl` and `token` from `useAuthStore`.

### 4. Auth Modal & Settings UI (`AuthModal.tsx` & `SettingsScreen.tsx`)
- **`AuthModal`**: Audiophile-themed modal supporting Login / Register tabs, secure password inputs, API base URL configuration, and error feedback.
- **`SettingsScreen`**:
  - Displays "Aura Cloud Account" card.
  - When logged in: shows user email, cloud sync status, "Sync Now" button, and "Sign Out".
  - When logged out: shows "Sign In / Register" button.
  - Active Music Provider selector in Settings allows picking between `Local Library`, `Internet Archive`, and `Aura Cloud (Supabase)`.

---

## Testing Strategy
- Unit tests for `AuraCloudProvider` in `packages/shared/src/providers/auraCloud.test.ts`.
- Unit tests for `useAuthStore` in `apps/mobile/src/store/authStore.test.ts`.
- Verification of full mobile test suite and API test suite.
