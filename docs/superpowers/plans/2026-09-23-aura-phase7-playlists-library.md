# AURA — Phase 7 Implementation Plan: Playlists CRUD, Artist Detail & Library Overhaul

See spec: `docs/superpowers/specs/2026-09-23-aura-phase7-playlists-library-design.md`

- [x] **Task 1**: SQLite schema & methods for playlists in `apps/mobile/src/library/database.ts`
- [x] **Task 2**: `usePlaylistStore` Zustand store in `apps/mobile/src/store/playlistStore.ts`
- [x] **Task 3**: `PlaylistDetailScreen.tsx` with Play All, rename, delete, and Add Tracks modal
- [x] **Task 4**: `AddToPlaylistSheet.tsx` & `SelectPlaylistSheet.tsx` for playlist track selection
- [x] **Task 5**: `ArtistDetailScreen.tsx` with discography & track list
- [x] **Task 6**: `TrackRow.tsx` long-press context menu integration
- [x] **Task 7**: 4-segment tabbed `LibraryScreen.tsx` overhaul (Artists, Albums, Tracks, Playlists)
- [x] **Task 8**: Wire `PlaylistDetail` and `ArtistDetail` in `RootNavigator.tsx`
- [x] **Task 9**: Unit tests in `playlistStore.test.ts` (all 6 tests passing)
