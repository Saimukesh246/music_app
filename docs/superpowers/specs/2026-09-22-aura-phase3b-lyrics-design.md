# AURA — Phase 3b Design: LRCLIB Lyrics

Date: 2026-09-22
Status: Approved

## Purpose

The last of Phase 3's non-recommendation subsystems: synchronized and plain
lyrics on the Now Playing screen, sourced from LRCLIB, cached locally, and
never blocking playback.

## Grounding in the actual API

Rendered LRCLIB's live docs (`https://lrclib.net`) rather than assuming, per
the lesson from Phase 2b's config-plugin mistake:

- `GET /api/get?track_name=...&artist_name=...&album_name=...&duration=...`
  — track name and artist name are required; album name and duration are
  optional but recommended. **Duration must match within ±2 seconds** of
  LRCLIB's record for a match to be returned.
- No match → `404 Not Found`. This is an expected, normal outcome, not an
  error to retry.
- A match's response includes `plainLyrics`, `syncedLyrics` (LRC-format text
  with `[mm:ss.xx]` timestamps), and `instrumental: boolean`. All three need
  their own handling — a track can have no lyrics at all (instrumental), only
  plain lyrics, or fully synced lyrics.
- `User-Agent` must identify the client (same requirement and format as
  MusicBrainz's, from 3a): `AppName vX.Y.Z (homepage or contact)`.
- Rate limiting is generous for normal use. The docs' 200–500ms guidance is
  specifically for *batch* operations (e.g. scanning a whole library) — this
  phase does on-demand, one-track-at-a-time fetching triggered by opening Now
  Playing, which doesn't need a persistent throttle the way 3a's bulk
  enrichment did.

## Scope framing

**No new screen, no new navigation route.** The original spec lists "lyrics"
as part of the Now Playing screen's own element list, alongside artwork and
transport controls — not a separate destination. A "Lyrics" toggle on Now
Playing swaps the artwork square for a scrolling lyrics view in place.

## Non-goals for this slice

- Batch/prefetch lyrics for the whole library — fetching happens per-track,
  on-demand, when Now Playing opens for that track.
- Publishing or flagging lyrics (LRCLIB's `/api/publish`/`/api/flag`) — read
  only.
- Any change to `MiniPlayer`, Home, Search, Library, or Settings.

## Components

### 1. LRC parser — `packages/shared/src/lyrics/lrc.ts`

Pure: `parseLrc(text: string): LyricLine[]` where
`LyricLine = { timeSec: number; text: string }`. Handles multiple timestamps
prefixing one line (a repeated chorus gets one text with several time marks),
both `.` and `:` as the fractional-second separator (both appear in the
wild), and ignores non-timestamp metadata tags (`[ar:...]`, `[ti:...]`,
`[length:...]`) — they simply don't match the timestamp pattern, so no special
metadata-parsing branch is needed. Lines are returned sorted by time.

### 2. LRCLIB client — `packages/shared/src/lyrics/lrclib.ts`

Pure, `fetch`-injected, same testability pattern as 3a's MusicBrainz/Cover
Art Archive clients:

```ts
getLyrics(fetchFn, { trackName, artistName, albumName, durationSec })
  -> { plainLyrics?: string; syncedLyrics?: string; instrumental: boolean } | null
```

`durationSec` is rounded before sending, per LRCLIB's matching requirement.
A 404, any other non-200, a network error, or a malformed body all resolve to
`null` — the caller cannot distinguish "not found" from "service unreachable"
and doesn't need to; both mean "no lyrics available right now."

### 3. Cache — a new `lyrics` table

`track_id TEXT PRIMARY KEY REFERENCES tracks(id)`, `plain_lyrics TEXT`,
`synced_lyrics TEXT`, `instrumental INTEGER`. Created via plain
`CREATE TABLE IF NOT EXISTS` in the existing schema string — a genuinely new
table needs no `ALTER TABLE` migration, unlike 3a's columns added to an
already-existing table. `LibraryDb` gains `getCachedLyrics(trackId)` and
`cacheLyrics(trackId, data)`.

A "not found" result is **not** cached — if LRCLIB doesn't have a track's
lyrics yet, the next time Now Playing opens for that track it tries again
(LRCLIB's own docs note missing tracks can be picked up by their background
fetching service and become available later). Caching only successful
matches keeps this simple and avoids permanently locking in a stale "no
lyrics" state.

### 4. `useLyrics(track)` hook

On track change: check the cache first; on a cache miss, call LRCLIB, cache
a successful result, and expose:

```ts
{ status: "loading" | "ready" | "unavailable" | "instrumental";
  plainLyrics?: string; syncedLines?: LyricLine[] }
```

This hook's fetch is entirely independent of `playerStore` — it never reads
or writes playback state, so it is structurally incapable of blocking audio.

### 5. `LyricsView` component

- Synced lyrics: a scrolling list of lines, the active line (found from
  `positionSec`) highlighted and auto-scrolled into view as playback
  advances.
- Plain-only lyrics: static scrollable text, no highlighting.
- Instrumental: an explicit "Instrumental — no lyrics" state.
- Unavailable: an explicit "Lyrics unavailable" state.
- Loading: a lightweight placeholder, never a blank screen.

### 6. `NowPlayingScreen` integration

One new "Lyrics" toggle button. Toggled on, it replaces the artwork square
with `LyricsView` in the same layout slot — title, artist, quality badge, and
transport controls stay visible and unchanged above/below it.

## Testing

Verifiable by me, without a device:

- LRC parser: single timestamp, multiple timestamps on one line, both
  fractional-second separators, metadata-tag lines correctly ignored, sort
  order, empty input
- LRCLIB client: successful match (synced + plain), instrumental match, 404
  (no match), non-200, network error, malformed JSON, rounded duration sent,
  descriptive User-Agent sent

Requires the user's Android device (explicitly unverified by me):

- Real LRCLIB matches for real scanned tracks
- The scrolling/highlighting behavior actually tracking real playback
  position smoothly
- That toggling lyrics view and switching tracks feels right, and playback
  audibly continues uninterrupted while a lookup is in flight

## Verification honesty

Claims about the parser and the client will be backed by test output. Claims
about real lyrics matches and the on-device scrolling experience will not be
made until the user confirms them.
