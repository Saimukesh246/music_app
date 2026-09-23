# AURA — Phase 6: Polish, Analytics & Queue

Date: 2026-09-23
Status: Implemented

## Purpose

Phase 6 completes the user-facing product by closing UX and feature gaps
that make AURA feel like a finished audiophile app rather than a scaffold.

## Delivered

### 1. Play history (`database.ts`)
- `play_history` table (migration-safe `CREATE TABLE IF NOT EXISTS`)
- `recordPlay(trackId)` — inserts a row with `played_at = strftime('%s','now')`
- `getPlayCounts(sinceEpoch)` — returns `Map<trackId, count>` for a time window
- Index on `played_at` for efficient range queries
- Fire-and-forget call in `playerStore.playTrack()` — never blocks playback

### 2. Shuffle (`playerStore.ts`)
- `shuffleEnabled: boolean` state (default `false`)
- `toggleShuffle()` action
- Fisher-Yates shuffle applied to queue members after index 0 (which is
  always the selected track). When disabled the queue order is preserved.
- The shuffle button in Now Playing illuminates when `shuffleEnabled`.

### 3. `useLibraryData` hook (extended)
- Now also returns `playCountsMap: Map<string,number>` (30-day window)
- Returns `libStats: LibraryStats` — total tracks, total hours, hi-res /
  lossless / lossy / unknown counts

### 4. HomeScreen (`HomeScreen.tsx`)
- Library Stats Card: total tracks, total playtime, quality breakdown pills
- "Your Heavy Rotation" section now sorted by real 30-day play counts;
  falls back to original album order when there is no history yet

### 5. SeekBar component (`SeekBar.tsx`)
- `PanResponder`-based touch-seekable scrubber with draggable amber thumb
- Props: `progress` (0-1), `onSeek(ratio)`, optional size overrides
- Replaces the flat non-interactive progress bar in Now Playing

### 6. QueueSheet component (`QueueSheet.tsx`)
- Bottom-slide `Modal` showing the play queue as a `FlatList`
- Currently playing track highlighted in accent colour
- Per-track remove button calls `TrackPlayer.remove(index)`
- Accessible (`accessibilityRole`, `accessibilityLabel`)

### 7. NowPlayingScreen (`NowPlayingScreen.tsx`)
- Real artwork loaded via `Image` from `track.artworkUrl`
- Blurred artwork (`blurRadius=40`) fills the background at 18% opacity
- SeekBar replaces the flat progress bar; drag to seek works on device
- Shuffle button (illuminated when active) joins the controls row
- Queue button in the header opens the QueueSheet modal
- Accessibility labels on all interactive elements

## Testing

- `playerStore.test.ts` — 4 new shuffle tests
- `SeekBar.test.tsx` — 5 tests
- `HomeScreen.helpers.test.ts` — 8 tests

## Final test counts

- **JS/TS**: 9 suites, 60 tests PASS
- **Python**: 9 suites, 52 tests PASS (no backend changes)
