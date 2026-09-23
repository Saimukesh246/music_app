# AURA — Phase 8 Implementation Plan: Offline Download Manager, Equalizer & Audiophile DAC Inspector

See spec: `docs/superpowers/specs/2026-09-23-aura-phase8-offline-eq-dac-design.md`

- [x] **Task 1**: SQLite schema & methods for `downloaded_tracks` in `apps/mobile/src/library/database.ts`
- [x] **Task 2**: `downloadStore.ts` using `expo-file-system` with progress tracking & persistence
- [x] **Task 3**: Integrate offline playback resolution in `playerStore.ts` and `providers`
- [x] **Task 4**: `equalizerStore.ts` with 5-band EQ, audiophile presets & Bit-Perfect mode toggle
- [x] **Task 5**: `EqualizerModal.tsx` component with interactive band sliders & visual curve
- [x] **Task 6**: `DacInspector.tsx` component & output route badge in `NowPlayingScreen.tsx` & `SettingsScreen.tsx`
- [x] **Task 7**: Sleep Timer implementation in `playerStore.ts` + UI trigger in `NowPlayingScreen.tsx`
- [x] **Task 8**: "Downloaded" tab / filter integration in `LibraryScreen.tsx`
- [x] **Task 9**: Unit tests for `downloadStore.test.ts` and `equalizerStore.test.ts`
- [x] **Task 10**: Verify entire mobile test suite passes & commit
