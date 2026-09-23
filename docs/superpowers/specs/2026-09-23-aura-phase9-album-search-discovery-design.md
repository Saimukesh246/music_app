# AURA — Phase 9 Design: Album Detail Screen, One-Tap Album Download & Universal Search Discovery

Date: 2026-09-23
Status: Approved

## Purpose

Phase 9 completes the core musical browsing graph and search discovery experience:

1. **Album Detail Screen (`AlbumDetailScreen.tsx`)**:
   - Hero header with high-resolution album artwork and subtle backdrop tint.
   - Metadata banner: Title, clickable Artist link (navigates to `ArtistDetail`), Release year, Track count, and Total duration.
   - Master quality badge (highest audio quality in album, e.g. `24-bit / 96 kHz FLAC`).
   - Transport actions:
     - **Play All**: Queues all album tracks starting from track 1.
     - **Shuffle**: Shuffles all album tracks.
     - **Download Album (1-Tap)**: Iterates and enqueues all album tracks into `useDownloadStore` for full offline listening.
   - Sequenced track listing ordered by track number with full context menus.

2. **Universal Search Discovery Engine (`SearchScreen.tsx`)**:
   - Live multi-category query against the active provider (Local or Internet Archive).
   - Category filter pills: `All`, `Tracks`, `Albums`, `Artists`.
   - **Recent Searches History**: Persisted in `AsyncStorage` with quick-delete and 1-tap re-query.
   - Categorized result sections in `All` mode:
     - Artists row: avatars with track count and navigation to `ArtistDetail`.
     - Albums row: artwork cards with navigation to `AlbumDetail`.
     - Tracks list: playable rows with hi-res badges.
   - Dedicated views for individual category filters.

3. **Global Navigation Graph Integration**:
   - Register `AlbumDetail` in `RootNavigator.tsx` (`RootStackParamList`).
   - Wire album click handlers across `HomeScreen.tsx`, `LibraryScreen.tsx`, and `ArtistDetailScreen.tsx` to open `AlbumDetailScreen`.

## Testing Strategy

- Unit tests for `SearchScreen` and recent search history helpers.
- Unit tests for `AlbumDetailScreen` data filtering, duration summation, and Download Album action.
- Verification of full mobile test suite.
