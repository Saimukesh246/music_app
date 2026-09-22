# AURA — Phase 3c Design: Audio Features + Local Recommendations

Date: 2026-09-22
Status: Approved

## Purpose

The last piece of the original Phase 3: ReccoBeats. Closes out the metadata
sub-phases (3a MusicBrainz/artwork, 3b LRCLIB lyrics, 3c this one).

## Grounding in the actual API

Rendered ReccoBeats' live docs (`https://reccobeats.com/docs`) rather than
assuming:

- `GET /v1/track/search?searchText=...&artist=...` — searches ReccoBeats' own
  catalog by title/artist, returning `content[].id` (a ReccoBeats track ID)
  among other fields.
- `GET /v1/audio-features?ids=...` (up to 40 IDs per call) — returns
  `acousticness`, `danceability`, `energy`, `instrumentalness`, `key`,
  `liveness`, `loudness`, `mode`, `speechiness`, `tempo`, `valence` per ID.
- `GET /v1/track/recommendation?seeds=...&size=...` — **critical finding**:
  `seeds` must be ReccoBeats or Spotify track IDs, and the endpoint returns
  tracks from ReccoBeats' own catalog (backed by Spotify's), not from the
  caller's library. There is no way to constrain results to "tracks I
  already have."
- Free, keyless, no registration. Rate limiting is unspecified in numeric
  terms but documented as enforced; standard `429` + `Retry-After` handling
  applies, and their own docs recommend caching to reduce request volume.

## The architectural decision this forces

Rendering `/v1/track/recommendation`'s results directly in "Recommended For
You" would show tracks the user doesn't own and can't play — an unplayable
ghost list, which conflicts with this app's product principle of never
showing something that isn't real. It also isn't actually useful yet: there's
no streaming provider until Phase 5.

**Decision (confirmed with the user): use ReccoBeats only to fetch audio
features for tracks already in the local library** (extending 3a's
enrichment pattern — search to resolve an ID, then fetch features for that
ID), and **compute "Recommended For You" with a local algorithm** that finds
library tracks whose audio-feature profile is closest to the user's
favorites. This satisfies the original spec's own requirement (Section 18)
not to depend entirely on one external API, and it means every recommendation
is a real, playable, already-owned track.

## Non-goals for this slice

- Anything from `/v1/track/recommendation` — not called at all in this phase.
- Listening history / skip tracking as a recommendation signal — no
  `play_history` table exists yet (Phase 6 territory). Favorites are the only
  seed signal for now.
- `key`, `liveness`, `loudness`, `mode`, `speechiness` — the original spec's
  own Audio Features section (Section 17) lists exactly six fields (BPM,
  Energy, Danceability, Valence, Acousticness, Instrumentalness); the rest
  aren't displayed anywhere and would be dead data.
- Mood-based playlists ("Night Drive"-style) — the underlying feature data
  this slice adds is what a future pass would need, but building that UI now
  would be speculative.

## Components

### 1. ReccoBeats client — `packages/shared/src/metadata/reccobeats.ts`

Pure, `fetch`-injected, same pattern as 3a/3b:

```ts
searchTrack(fetchFn, trackName, artistName) -> string | null   // ReccoBeats track ID
getAudioFeatures(fetchFn, ids: string[]) -> Map<string, AudioFeatures>
```

### 2. Schema

`tracks` gains `reccobeats_id`, `acousticness`, `danceability`, `energy`,
`instrumentalness`, `valence`, `tempo` — all nullable, added via the existing
`ensureColumn` migration helper from 3a (columns on an existing table).
`@aura/types`' `Track` gains an optional `audioFeatures?: AudioFeatures`
field, populated by `getAllTracks`/`searchTracks` when present — the same
pattern `Album.artworkUrl`/`releaseDate` already established in Phase 1/3a.

### 3. Enrichment orchestrator — `apps/mobile/src/metadata/audioFeaturesEnrichment.ts`

For each track missing `reccobeats_id`: search (throttled, its own 1 req/sec
queue independent of MusicBrainz's), then fetch and persist its audio
features. Same failure isolation as 3a: one track failing skips to the next,
never blocks the rest, never crashes. Chained into the existing "Enrich
Metadata" button in Settings, alongside 3a's MusicBrainz/Cover Art step.

### 4. Local recommendation algorithm — `packages/shared/src/recommendations/recommend.ts`

Pure function: given candidate tracks and seed tracks (both with
`audioFeatures`), compute each candidate's Euclidean distance from the seed
centroid across the six feature dimensions (tempo normalized to the same 0–1
scale as the others) and return the closest N, excluding the seeds
themselves. No network, no database — fully unit-testable with fixture data.

### 5. Home screen integration

`HomeScreen` computes recommendations from tracks already loaded via
`useLibraryData` and favorites from `useLibraryStore` — no new data
fetching. Recommended tracks are mapped to their parent albums and rendered
through the exact same `Section`/`ArtworkCard` pattern every other Home
section already uses. If there are no favorites, or no tracks have cached
features yet, the section doesn't render — matching the existing
empty-section behavior from Phase 2a.

## Testing

Verifiable by me, without a device:

- ReccoBeats client: successful search, no match, successful feature fetch,
  missing ID in response, non-200, network error, malformed JSON
- The recommendation algorithm: correct nearest-neighbor ordering against
  hand-built feature vectors, seed exclusion, empty result when there are no
  seeds or no featured candidates, tempo normalization affecting distance
  correctly

Requires the user's Android device (explicitly unverified by me):

- Real ReccoBeats matches and feature values for real scanned tracks
- Whether the resulting "Recommended For You" picks feel meaningfully
  related to favorited tracks
- That enrichment continues to not block the UI with this second orchestrator
  now also running

## Verification honesty

Claims about the client and the algorithm will be backed by test output.
Claims about real-world recommendation quality will not be made until the
user confirms them.
