# AURA — Phase 7 Design: Playlists CRUD, Artist Detail & Library Overhaul

Date: 2026-09-23
Status: Implemented

## Purpose

Phase 7 delivers playlist management and library navigation polish:

1. **Playlists Database & CRUD**:
   - `playlists` and `playlist_tracks` SQLite schema in `database.ts`
   - Database operations: `createPlaylist(title)`, `getPlaylists()`, `getPlaylistTracks(playlistId)`, `addTrackToPlaylist(playlistId, trackId)`, `removeTrackFromPlaylist(playlistId, trackId)`, `renamePlaylist(playlistId, title)`, `deletePlaylist(playlistId)`.
2. **Playlist Store**:
   - `playlistStore.ts` with Zustand state `playlists: PlaylistMeta[]`
   - Optimistic state updates for instant UI response and sorted ordering.
3. **Screens & Modals**:
   - `PlaylistDetailScreen.tsx`: Displays tracks, Play All button, rename action, delete with confirmation, and "Add Tracks" picker modal.
   - `AddToPlaylistSheet.tsx`: Multi-select/searchable track picker sheet to add tracks to a specific playlist.
   - `SelectPlaylistSheet.tsx`: Modal sheet triggered from track context menus to add a track to any playlist or create a new playlist on the fly.
   - `ArtistDetailScreen.tsx`: Displays artist info, horizontal scrolling discography/albums, and all tracks with full playback actions.
4. **Library Screen Overhaul**:
   - 4-segment tab bar: Artists, Albums, Tracks, Playlists.
   - Artists: Alphabetical list navigation to ArtistDetail.
   - Albums: Grid of ArtworkCards with track counts.
   - Tracks: Full track list with quick play and context actions.
   - Playlists: Playlist grid/list with inline creation dialog.
5. **TrackRow Context Menu**:
   - Long-press menu on any track: "Add to Playlist", "Play Next", "Add to Queue", "Favorite".

## Testing

- `playlistStore.test.ts` — 6 unit tests covering hydration, sorted creation, deletion, optimistic rename, and playlist track add/remove delegation.
- Full mobile suite: 10 test suites, 66 tests passing.
