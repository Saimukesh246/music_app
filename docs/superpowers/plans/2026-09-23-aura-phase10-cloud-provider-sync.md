# AURA — Phase 10 Implementation Plan: Aura Cloud Provider, Cloud Library Sync & Authentication

Date: 2026-09-23
Status: Approved

## Overview
Connect the AURA mobile app directly with the FastAPI backend powered by Supabase PostgreSQL to enable cloud lossless streaming, remote catalog search, and bidirectional cloud sync for favorites, playlists, and user authentication.

## Tasks

- [ ] **1. Shared Library: `AuraCloudProvider`**
  - [ ] Create `packages/shared/src/providers/auraCloud.ts` conforming to `MusicProvider`.
  - [ ] Implement `search`, `getArtist`, `getAlbum`, `getTrack`, `getPlaylist`, `getRecommendations`, and `getPlaybackSource`.
  - [ ] Create unit tests in `packages/shared/src/providers/auraCloud.test.ts`.
  - [ ] Export `AuraCloudProvider` in `packages/shared/src/index.ts`.

- [ ] **2. Mobile State: `authStore` & Cloud Sync**
  - [ ] Create `apps/mobile/src/store/authStore.ts` with Zustand and AsyncStorage.
  - [ ] Support `login`, `register`, `logout`, `setApiBaseUrl`, and `syncCloudData`.
  - [ ] Create unit tests in `apps/mobile/src/store/authStore.test.ts`.

- [ ] **3. Provider Registry: `registry.ts`**
  - [ ] Add `"aura-cloud"` to `ProviderId` and `REGISTERED_PROVIDERS`.
  - [ ] Implement lazy instantiation of `AuraCloudProvider`.

- [ ] **4. UI Components: `AuthModal` & `SettingsScreen`**
  - [ ] Create `apps/mobile/src/components/AuthModal.tsx` for Login / Register / Server URL configuration.
  - [ ] Update `apps/mobile/src/screens/SettingsScreen.tsx` with Aura Cloud account card and Sync actions.

- [ ] **5. Verification & Test Suite Execution**
  - [ ] Run mobile tests (`npm test` in `apps/mobile`).
  - [ ] Run API tests (`pytest` in `apps/api`).
  - [ ] Commit and push to GitHub repository.
