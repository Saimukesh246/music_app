# AURA -- Phase 5 Implementation Plan: External Music Providers

> **For agentic workers:** Steps use checkbox (- [x]) syntax for tracking.

See docs/superpowers/specs/2026-09-22-aura-phase5-providers-design.md for the full design.

---

## Task 1: InternetArchiveProvider in packages/shared

**Files created:**
- packages/shared/src/providers/internetArchive.ts
- packages/shared/src/providers/index.ts
- packages/shared/src/providers/internetArchive.test.ts

**Modified:**
- packages/shared/src/index.ts (add InternetArchiveProvider export)

- [x] **Step 1: Write internetArchive.ts** -- implements full MusicProvider interface;
  honest quality from IA format field; FLAC > WAV > MP3 preference; all failures caught.

- [x] **Step 2: Write providers/index.ts** -- re-exports InternetArchiveProvider.

- [x] **Step 3: Write internetArchive.test.ts** -- 14 unit tests covering search mapping,
  network failure graceful return, FLAC preference, MP3 fallback, quality label
  accuracy, getRecommendations filtering.

- [x] **Step 4: Update packages/shared/src/index.ts** -- export InternetArchiveProvider.

- [x] **Step 5: Run to verify** -- 
px pnpm --filter @aura/shared test
  Result: 10 suites, 81 tests PASS.

- [x] **Step 6: Commit**
  eat(shared): add Internet Archive MusicProvider

---

## Task 2: Provider registry in apps/mobile

**Files created:**
- pps/mobile/src/providers/registry.ts
- pps/mobile/src/providers/registry.test.ts

**Modified:**
- pps/mobile/src/providers/index.ts (re-exports from registry)

- [x] **Step 1: Install @react-native-async-storage/async-storage**

- [x] **Step 2: Write registry.ts** -- multi-provider registry backed by AsyncStorage;
  lazy singletons per provider; getActiveProvider(), setActiveProvider(), getProvider()
  backwards compat.

- [x] **Step 3: Replace providers/index.ts** -- re-exports from registry so all callers
  (playerStore, libraryStore, SettingsScreen, etc.) work without changes.

- [x] **Step 4: Write registry.test.ts** -- 6 unit tests with static mocks for
  AsyncStorage, expo-sqlite, react-native-track-player.

- [x] **Step 5: Run to verify** -- 
px jest --testPathPattern=registry
  Result: 6 tests PASS.

- [x] **Step 6: Commit**
  eat(mobile): add multi-provider registry with AsyncStorage persistence

---

## Task 3: Music Source picker in SettingsScreen

**Modified:**
- pps/mobile/src/screens/SettingsScreen.tsx

- [x] **Step 1: Add Music Source section** -- new MUSIC SOURCE group with radio-style
  Pressable rows for each registered provider. Calls setActiveProvider() on press.
  Shows description text. Updates version string to Phase 5.

- [x] **Step 2: Commit**
  eat(mobile): add Music Source picker to Settings

---

## Task 4: /ia proxy router in apps/api

**Files created:**
- pps/api/app/routers/ia.py
- pps/api/tests/test_ia.py

**Modified:**
- pps/api/app/main.py (add ia router)

- [x] **Step 1: Write ia.py** -- GET /ia/search (auth, q required, httpx proxy to IA
  advancedsearch, returns IASearchResults) and GET /ia/item/{identifier} (auth, httpx
  proxy to IA metadata, returns IAItemDetail with best_audio_file preferred FLAC>MP3).

- [x] **Step 2: Register in main.py** -- app.include_router(ia.router).

- [x] **Step 3: Write test_ia.py** -- 8 pytest tests with httpx.get mocked via
  unittest.mock.patch.

- [x] **Step 4: Run to verify** -- python -m pytest apps/api/tests/test_ia.py -v
  Result: 8 tests PASS.

- [x] **Step 5: Run full suite** -- python -m pytest apps/api -v
  Result: 52 tests PASS.

- [x] **Step 6: Commit**
  eat(api): add /ia proxy router for Internet Archive search and item metadata

---

## Task 5: Docs and full verification

- [x] **Step 1: Write design spec** -- docs/superpowers/specs/2026-09-22-aura-phase5-providers-design.md

- [x] **Step 2: Write this plan** -- docs/superpowers/plans/2026-09-22-aura-phase5-providers.md

- [x] **Step 3: Run complete monorepo test suite**
  - 
px pnpm test -- 7 suites, 43 JS/TS tests PASS
  - python -m pytest apps/api -- 52 tests PASS

- [x] **Step 4: Commit**
  docs(phase5): add design spec and implementation plan
