# AURA — Phase 3a Design: Metadata + Artwork Enrichment

Date: 2026-09-22
Status: Approved

## Purpose

The original brief's Phase 3 bundles four independent external services
(ReccoBeats, MusicBrainz, Cover Art Archive, LRCLIB). Following the same
subsystem-decomposition used for Phase 2 (2a data layer / 2b audio engine),
this is broken into three sub-phases:

- **3a (this spec):** MusicBrainz + Cover Art Archive — enrich the locally
  scanned library with real metadata and real album artwork.
- **3b:** LRCLIB lyrics.
- **3c:** ReccoBeats recommendations.

3a is first because its output (normalized artist/release identity via
MusicBrainz IDs) is the natural foundation the other two would key off of,
and because it has the most immediately visible payoff: real album artwork
in place of the placeholder letter tiles that have been on screen since
Phase 1.

## No secrets, no backend needed yet

The original spec's security section requires provider calls to route through
a backend so secrets never live in the mobile app. MusicBrainz, Cover Art
Archive, and LRCLIB are free, keyless, public APIs — there is no secret to
protect. This principle becomes load-bearing later for authenticated
providers (TIDAL, Phase 5), not here.

## Non-goals for this slice

- Genre/tag data — no screen displays it yet; populating it would be dead
  data with no visible effect.
- Artist artwork — no screen displays artist images yet either.
- A progress bar or detailed per-album progress UI — a background task with a
  simple "Enriching…" label is enough for this slice.
- Lyrics (3b) and recommendations (3c) — separate specs.
- Any change to `ArtworkCard`, `TrackRow`, or any other Phase 1/2 UI
  component. `ArtworkCard` already renders `artworkUrl` when present (built
  in Phase 1, unused until now) — this slice only needs to populate data.

## Components

### 1. MusicBrainz and Cover Art Archive clients — `packages/shared/src/metadata/`

Pure, dependency-free, taking an injected `fetch` so they're unit-testable
with mocked HTTP responses (same pattern as the FLAC parser):

```ts
searchRelease(fetchFn, artist, album) -> {
  releaseMbid, artistMbid, releaseDate
} | null
```

One MusicBrainz release-search request covers both the release MBID and the
artist MBID — the search response's `artist-credit[0].artist.id` is already
the artist MBID, so no second request is needed per album.

```ts
getFrontCoverUrl(fetchFn, releaseMbid) -> string | null
```

Cover Art Archive returns a redirect to the actual image, or 404 if there is
no cover. A `null` return means "no art available," not an error.

### 2. Shared throttle — `packages/shared/src/metadata/throttle.ts`

A single queue enforcing at least 1 second between requests, shared across
*both* services combined — one polite citizen against MusicBrainz's usage
guidelines, not two independent limiters that could double the effective
rate. The delay function is injected so tests don't actually wait.

### 3. Enrichment orchestrator — `apps/mobile/src/metadata/enrichment.ts`

For each album in the local library missing a `musicbrainz_id`:

1. Look up the release via MusicBrainz (throttled).
2. On success: persist `musicbrainz_id` and `release_date` on the album,
   `musicbrainz_id` on the artist.
3. Fetch the front cover URL from Cover Art Archive (throttled).
4. On success: download and cache the image via `expo-file-system` into the
   cache directory; persist the local `file://` path as the album's
   `artworkUrl`.
5. On any failure at any step for a given album: log nothing user-facing,
   skip to the next album. Never crash, never block the rest of the queue,
   never block library browsing. Nothing is auto-retried — a failed album
   stays unenriched until the user re-runs enrichment.

### 4. Schema migration

`albums` gains `musicbrainz_id TEXT`, `release_date TEXT`; `artists` gains
`musicbrainz_id TEXT`. Since `CREATE TABLE IF NOT EXISTS` does not add
columns to an already-existing table (the Phase 2a schema is already on the
user's device), `openLibrary()` gains a migration step: check
`PRAGMA table_info` per table and run `ALTER TABLE ... ADD COLUMN` only for
columns that are missing.

### 5. Trigger

Settings' existing scan handler chains into enrichment automatically after a
successful scan — fire-and-forget, does not block the "scan complete" alert
the user already sees. Settings also gets a standalone "Enrich Metadata"
button to manually re-run enrichment (covers albums that failed, or were
scanned while offline).

## Testing

Verifiable by me, without a device:

- MusicBrainz client: successful lookup, no-match response, malformed
  response, network error, timeout
- Cover Art Archive client: successful URL, 404 (no art), network error
- Throttle: enforces the minimum spacing between calls, using an injected,
  mockable delay
- The migration: adds missing columns without erroring when they already
  exist

Requires the user's Android device (explicitly unverified by me):

- Real MusicBrainz/Cover Art Archive responses for real scanned albums
- Real image download and caching, and that `ArtworkCard` actually displays
  the cached artwork
- That enrichment genuinely doesn't block or slow down the UI while running
- Overall timing/experience of enrichment for a real library

## Verification honesty

Claims about the clients, throttle, and migration will be backed by test
output. Claims about real-world enrichment results and artwork display will
not be made until the user confirms them on device.
