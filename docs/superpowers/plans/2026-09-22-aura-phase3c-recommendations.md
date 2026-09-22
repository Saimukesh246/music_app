# AURA Phase 3c Implementation Plan — Audio Features + Local Recommendations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use ReccoBeats to enrich local tracks with real audio features
(acousticness, danceability, energy, instrumentalness, valence, tempo), then
compute "Recommended For You" entirely from the local library via a
nearest-neighbor algorithm seeded by favorites — never rendering ReccoBeats'
own recommendation endpoint, whose results aren't tracks the user owns.

**Architecture:** A pure, `fetch`-injected ReccoBeats client in
`packages/shared` (search-then-features, same two-step resolution pattern as
3a's MusicBrainz client). A pure local recommendation algorithm, also in
`packages/shared`, operating only on `Track` objects already carrying
`audioFeatures` — no network, no database. An orchestrator in `apps/mobile`
enriches tracks the same way 3a's orchestrator enriches albums, chained into
the existing "Enrich Metadata" button. `HomeScreen` computes recommendations
client-side from data it already has loaded.

**Tech Stack:** TypeScript, plain-node Jest (`packages/shared`), the existing
`expo-sqlite` database and `ensureColumn` migration helper from 3a.

## Global Constraints

- ReccoBeats' `/v1/track/recommendation` endpoint is never called — its
  results are external catalog tracks the user doesn't own, which would
  produce unplayable entries if shown. Only `/v1/track/search` (ID
  resolution) and `/v1/audio-features` (feature values) are used.
- The local recommendation algorithm operates only on tracks that already
  carry `audioFeatures`. A track with no cached features is never a
  candidate or a seed.
- Only these six feature fields are persisted or displayed: acousticness,
  danceability, energy, instrumentalness, valence, tempo — matching the
  original spec's own Audio Features list exactly. `key`, `liveness`,
  `loudness`, `mode`, `speechiness` are not stored.
- One track's enrichment failing (no ReccoBeats match, network error) must
  never crash, never block the rest of the queue, never block library
  browsing. Nothing is auto-retried, same as 3a.
- The ReccoBeats enrichment throttle is its own instance, independent of 3a's
  MusicBrainz/Cover-Art throttle — they're different services.
- Favorites are the only recommendation seed signal in this slice. No
  listening-history tracking exists yet.
- No change to `MiniPlayer`, Search, Library, `NowPlayingScreen`, or Settings
  beyond extending the existing enrichment button. Only `HomeScreen` gets a
  new section.

---

## File Structure

```
packages/types/src/
└── index.ts                              (modify: AudioFeatures + Track.audioFeatures)

packages/shared/src/
├── index.ts                              (modify: export reccobeats + recommend)
├── metadata/
│   ├── reccobeats.ts                     (new)
│   └── reccobeats.test.ts                (new)
└── recommendations/
    ├── recommend.ts                      (new)
    └── recommend.test.ts                 (new)

apps/mobile/src/
├── library/
│   └── database.ts                       (modify: 7 new track columns + 2 methods)
├── metadata/
│   └── audioFeaturesEnrichment.ts        (new)
├── screens/
│   ├── SettingsScreen.tsx                (modify: chain into handleEnrich)
│   └── HomeScreen.tsx                    (modify: Recommended For You section)
```

---

### Task 1: `AudioFeatures` type

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `AudioFeatures` interface; `Track.audioFeatures?: AudioFeatures`.
  Consumed by every other task in this plan.

- [ ] **Step 1: Add the type and field**

In `packages/types/src/index.ts`, add this interface above `Track`:

```typescript
export interface AudioFeatures {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  valence: number;
  tempo: number; // BPM
}
```

Add the field to the existing `Track` interface:

```typescript
export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string;
  albumTitle: string;
  artworkUrl?: string;
  quality: AudioQualityInfo;
  audioFeatures?: AudioFeatures;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add AudioFeatures and Track.audioFeatures"
```

---

### Task 2: ReccoBeats client (TDD)

**Files:**
- Create: `packages/shared/src/metadata/reccobeats.ts`
- Test: `packages/shared/src/metadata/reccobeats.test.ts`

**Interfaces:**
- Consumes: `FetchLike` from `./musicbrainz` (reused, not redefined).
- Produces: `searchTrack(fetchFn, trackName, artistName): Promise<string | null>`
  and `getAudioFeatures(fetchFn, ids: string[]): Promise<Map<string, AudioFeatures>>`
  (using the `AudioFeatures` shape from `@aura/types`, re-imported here).
  Consumed by `audioFeaturesEnrichment.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/metadata/reccobeats.test.ts
import { searchTrack, getAudioFeatures } from "./reccobeats";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("searchTrack", () => {
  it("returns the first match's id", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [{ id: "recco-123" }] }) });
    expect(await searchTrack(fetchFn, "Low Tide", "Nocturne Field")).toBe("recco-123");
  });

  it("returns null when there are no results", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [] }) });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 404 });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });
});

describe("getAudioFeatures", () => {
  it("returns a map keyed by track id", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        content: [
          {
            id: "recco-123",
            acousticness: 0.5,
            danceability: 0.6,
            energy: 0.7,
            instrumentalness: 0.1,
            valence: 0.4,
            tempo: 120,
          },
        ],
      }),
    });

    const result = await getAudioFeatures(fetchFn, ["recco-123"]);

    expect(result.get("recco-123")).toEqual({
      acousticness: 0.5,
      danceability: 0.6,
      energy: 0.7,
      instrumentalness: 0.1,
      valence: 0.4,
      tempo: 120,
    });
  });

  it("returns an empty map on a non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 400 });
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("returns an empty map when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("skips entries with no id in the response", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [{ acousticness: 0.5 }] }) });
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("sends every id as a repeated query parameter", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [] }) });
    await getAudioFeatures(fetchFn, ["a", "b"]);
    const [url] = fetchFn.mock.calls[0];
    expect(url).toContain("ids=a");
    expect(url).toContain("ids=b");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test reccobeats`
Expected: FAIL — cannot find module `./reccobeats`.

- [ ] **Step 3: Write `packages/shared/src/metadata/reccobeats.ts`**

```typescript
import type { AudioFeatures } from "@aura/types";
import type { FetchLike } from "./musicbrainz";

interface SearchResponse {
  content?: Array<{ id?: string }>;
}

export async function searchTrack(
  fetchFn: FetchLike,
  trackName: string,
  artistName: string
): Promise<string | null> {
  const params = new URLSearchParams({
    searchText: trackName,
    artist: artistName,
    size: "1",
  });
  const url = `https://api.reccobeats.com/v1/track/search?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: SearchResponse;
  try {
    body = (await response.json()) as SearchResponse;
  } catch {
    return null;
  }

  return body.content?.[0]?.id ?? null;
}

interface AudioFeaturesResponse {
  content?: Array<{
    id?: string;
    acousticness?: number;
    danceability?: number;
    energy?: number;
    instrumentalness?: number;
    valence?: number;
    tempo?: number;
  }>;
}

export async function getAudioFeatures(
  fetchFn: FetchLike,
  ids: string[]
): Promise<Map<string, AudioFeatures>> {
  const result = new Map<string, AudioFeatures>();

  const params = new URLSearchParams();
  ids.forEach((id) => params.append("ids", id));
  const url = `https://api.reccobeats.com/v1/audio-features?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url);
  } catch {
    return result;
  }

  if (!response.ok) return result;

  let body: AudioFeaturesResponse;
  try {
    body = (await response.json()) as AudioFeaturesResponse;
  } catch {
    return result;
  }

  for (const item of body.content ?? []) {
    if (!item.id) continue;
    result.set(item.id, {
      acousticness: item.acousticness ?? 0,
      danceability: item.danceability ?? 0,
      energy: item.energy ?? 0,
      instrumentalness: item.instrumentalness ?? 0,
      valence: item.valence ?? 0,
      tempo: item.tempo ?? 0,
    });
  }

  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test reccobeats`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/metadata/reccobeats.ts packages/shared/src/metadata/reccobeats.test.ts
git commit -m "feat(shared): add ReccoBeats search and audio-features client"
```

---

### Task 3: Local recommendation algorithm (TDD)

**Files:**
- Create: `packages/shared/src/recommendations/recommend.ts`
- Test: `packages/shared/src/recommendations/recommend.test.ts`

**Interfaces:**
- Consumes: `Track` from `@aura/types`.
- Produces: `recommendTracks(candidates: Track[], seeds: Track[], count: number): Track[]`.
  Consumed by `HomeScreen` (Task 7).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/recommendations/recommend.test.ts
import { recommendTracks } from "./recommend";
import type { Track, AudioFeatures } from "@aura/types";

function makeTrack(id: string, features?: Partial<AudioFeatures>): Track {
  return {
    id,
    title: id,
    artistId: "artist-1",
    artistName: "Artist",
    albumId: "album-1",
    albumTitle: "Album",
    quality: { format: "FLAC", durationSec: 200 },
    audioFeatures: features
      ? {
          acousticness: 0,
          danceability: 0,
          energy: 0,
          instrumentalness: 0,
          valence: 0,
          tempo: 120,
          ...features,
        }
      : undefined,
  };
}

describe("recommendTracks", () => {
  it("ranks candidates by closeness to the seed centroid", () => {
    const seed = makeTrack("seed", { energy: 0.9, valence: 0.9 });
    const close = makeTrack("close", { energy: 0.85, valence: 0.85 });
    const far = makeTrack("far", { energy: 0.1, valence: 0.1 });

    const result = recommendTracks([close, far], [seed], 2);

    expect(result.map((t) => t.id)).toEqual(["close", "far"]);
  });

  it("excludes the seed tracks themselves from the results", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const other = makeTrack("other", { energy: 0.5 });

    const result = recommendTracks([seed, other], [seed], 5);

    expect(result.map((t) => t.id)).toEqual(["other"]);
  });

  it("returns an empty array when no seeds have audio features", () => {
    const seed = makeTrack("seed");
    const candidate = makeTrack("candidate", { energy: 0.5 });

    expect(recommendTracks([candidate], [seed], 5)).toEqual([]);
  });

  it("skips candidates with no audio features", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const featureless = makeTrack("featureless");
    const featured = makeTrack("featured", { energy: 0.5 });

    const result = recommendTracks([featureless, featured], [seed], 5);

    expect(result.map((t) => t.id)).toEqual(["featured"]);
  });

  it("respects the requested count", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const candidates = [
      makeTrack("a", { energy: 0.5 }),
      makeTrack("b", { energy: 0.5 }),
      makeTrack("c", { energy: 0.5 }),
    ];

    expect(recommendTracks(candidates, [seed], 2)).toHaveLength(2);
  });

  it("averages multiple seeds into one centroid", () => {
    const seedA = makeTrack("seedA", { energy: 0.0 });
    const seedB = makeTrack("seedB", { energy: 1.0 });
    const mid = makeTrack("mid", { energy: 0.5 });
    const extreme = makeTrack("extreme", { energy: 0.95 });

    const result = recommendTracks([extreme, mid], [seedA, seedB], 2);

    expect(result.map((t) => t.id)).toEqual(["mid", "extreme"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test recommend`
Expected: FAIL — cannot find module `./recommend`.

- [ ] **Step 3: Write `packages/shared/src/recommendations/recommend.ts`**

```typescript
import type { AudioFeatures, Track } from "@aura/types";

function toVector(f: AudioFeatures): number[] {
  return [f.acousticness, f.danceability, f.energy, f.instrumentalness, f.valence, f.tempo / 250];
}

function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

function centroid(vectors: number[][]): number[] {
  const dims = vectors[0].length;
  const sums = new Array(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i++) sums[i] += vector[i];
  }
  return sums.map((sum) => sum / vectors.length);
}

export function recommendTracks(candidates: Track[], seeds: Track[], count: number): Track[] {
  const seedVectors = seeds
    .filter((t): t is Track & { audioFeatures: AudioFeatures } => Boolean(t.audioFeatures))
    .map((t) => toVector(t.audioFeatures));
  if (seedVectors.length === 0) return [];

  const target = centroid(seedVectors);
  const seedIds = new Set(seeds.map((t) => t.id));

  return candidates
    .filter(
      (t): t is Track & { audioFeatures: AudioFeatures } =>
        Boolean(t.audioFeatures) && !seedIds.has(t.id)
    )
    .map((t) => ({ track: t, dist: distance(toVector(t.audioFeatures), target) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map((s) => s.track);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test recommend`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/recommendations/recommend.ts packages/shared/src/recommendations/recommend.test.ts
git commit -m "feat(shared): add a local nearest-neighbor recommendation algorithm"
```

---

### Task 4: Export the ReccoBeats and recommendation APIs

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `searchTrack`, `getAudioFeatures`, `recommendTracks` re-exported
  from `@aura/shared`. Consumed by `audioFeaturesEnrichment.ts` (Task 6) and
  `HomeScreen` (Task 7).

- [ ] **Step 1: Add the exports**

Append to `packages/shared/src/index.ts`:

```typescript
export { searchTrack, getAudioFeatures } from "./metadata/reccobeats";
export { recommendTracks } from "./recommendations/recommend";
```

- [ ] **Step 2: Run the whole shared suite**

Run: `pnpm --filter @aura/shared test`
Expected: PASS (69 tests — 53 from Phase 3b plus 16 new).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export the ReccoBeats and recommendation APIs"
```

---

### Task 5: Database columns and pending/set methods for audio features

**Files:**
- Modify: `apps/mobile/src/library/database.ts`

**Interfaces:**
- Produces: `getTracksPendingAudioFeatures(): Promise<{ id: string; title: string; artistName: string }[]>`
  and `setTrackAudioFeatures(trackId: string, data: { reccobeatsId: string } & AudioFeatures): Promise<void>`
  on `LibraryDb`. `getAllTracks`/`searchTracks` now populate
  `Track.audioFeatures` when present. Consumed by
  `audioFeaturesEnrichment.ts` (Task 6) and `HomeScreen` (Task 7, via
  `useLibraryData`, unchanged).

- [ ] **Step 1: Import `AudioFeatures`**

Change the top-of-file import in `apps/mobile/src/library/database.ts`:

```typescript
import type { Album, Artist, AudioFeatures, AudioQualityInfo, Track } from "@aura/types";
```

- [ ] **Step 2: Extend `LibraryDb`**

Add these two methods to the `LibraryDb` interface, after `cacheLyrics`:

```typescript
  getTracksPendingAudioFeatures(): Promise<
    { id: string; title: string; artistName: string }[]
  >;
  setTrackAudioFeatures(
    trackId: string,
    data: { reccobeatsId: string } & AudioFeatures
  ): Promise<void>;
```

- [ ] **Step 3: Add the migration columns**

In `openLibrary()`, add these six calls after the existing `ensureColumn`
calls:

```typescript
  await ensureColumn(db, "tracks", "reccobeats_id", "TEXT");
  await ensureColumn(db, "tracks", "acousticness", "REAL");
  await ensureColumn(db, "tracks", "danceability", "REAL");
  await ensureColumn(db, "tracks", "energy", "REAL");
  await ensureColumn(db, "tracks", "instrumentalness", "REAL");
  await ensureColumn(db, "tracks", "valence", "REAL");
  await ensureColumn(db, "tracks", "tempo", "REAL");
```

- [ ] **Step 4: Extend `TrackRow` and `rowToTrack`**

Add these fields to the `TrackRow` interface:

```typescript
  acousticness: number | null;
  danceability: number | null;
  energy: number | null;
  instrumentalness: number | null;
  valence: number | null;
  tempo: number | null;
```

Update `rowToTrack` to populate `audioFeatures` when every field is present
(they are always written together by `setTrackAudioFeatures`, so checking
one is enough, but checking all is unambiguous and cheap):

```typescript
function rowToTrack(row: TrackRow): Track {
  const quality: AudioQualityInfo = {
    format: row.format as AudioQualityInfo["format"],
    durationSec: row.duration_sec,
  };
  if (row.bit_depth !== null) quality.bitDepth = row.bit_depth;
  if (row.sample_rate_hz !== null) quality.sampleRateHz = row.sample_rate_hz;
  if (row.channels !== null) quality.channels = row.channels;
  if (row.bitrate_kbps !== null) quality.bitrateKbps = row.bitrate_kbps;

  const track: Track = {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    albumId: row.album_id,
    albumTitle: row.album_title,
    quality,
  };

  if (
    row.acousticness !== null &&
    row.danceability !== null &&
    row.energy !== null &&
    row.instrumentalness !== null &&
    row.valence !== null &&
    row.tempo !== null
  ) {
    track.audioFeatures = {
      acousticness: row.acousticness,
      danceability: row.danceability,
      energy: row.energy,
      instrumentalness: row.instrumentalness,
      valence: row.valence,
      tempo: row.tempo,
    };
  }

  return track;
}
```

- [ ] **Step 5: Add the new columns to `TRACK_SELECT`**

```typescript
const TRACK_SELECT = `
SELECT tracks.id, tracks.title, tracks.artist_id, tracks.album_id,
       tracks.format, tracks.bit_depth, tracks.sample_rate_hz,
       tracks.channels, tracks.bitrate_kbps, tracks.duration_sec,
       tracks.acousticness, tracks.danceability, tracks.energy,
       tracks.instrumentalness, tracks.valence, tracks.tempo,
       artists.name  AS artist_name,
       albums.title  AS album_title
FROM tracks
JOIN artists ON artists.id = tracks.artist_id
JOIN albums  ON albums.id  = tracks.album_id
`;
```

- [ ] **Step 6: Implement the two new methods**

Add after `cacheLyrics` in the object returned from `openLibrary()`:

```typescript
    async getTracksPendingAudioFeatures() {
      const rows = await db.getAllAsync<{ id: string; title: string; artist_name: string }>(
        `SELECT tracks.id, tracks.title, artists.name AS artist_name
         FROM tracks JOIN artists ON artists.id = tracks.artist_id
         WHERE tracks.reccobeats_id IS NULL`
      );
      return rows.map((row) => ({ id: row.id, title: row.title, artistName: row.artist_name }));
    },

    async setTrackAudioFeatures(trackId, data) {
      await db.runAsync(
        `UPDATE tracks SET
           reccobeats_id = ?, acousticness = ?, danceability = ?, energy = ?,
           instrumentalness = ?, valence = ?, tempo = ?
         WHERE id = ?`,
        data.reccobeatsId,
        data.acousticness,
        data.danceability,
        data.energy,
        data.instrumentalness,
        data.valence,
        data.tempo,
        trackId
      );
    },
```

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 8: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/library/database.ts
git commit -m "feat(mobile): add audio-feature columns and pending/set queries"
```

---

### Task 6: Audio-features enrichment orchestrator

**Files:**
- Create: `apps/mobile/src/metadata/audioFeaturesEnrichment.ts`

**Interfaces:**
- Consumes: `searchTrack`, `getAudioFeatures`, `createThrottle` from
  `@aura/shared` (Tasks 2-4); `LibraryDb` from `../library/database` (Task 5).
- Produces: `enrichAudioFeatures(db: LibraryDb): Promise<{ enriched: number; skipped: number }>`,
  consumed by `SettingsScreen` (Task 7).

Same judgment call as 3a's `enrichment.ts` and 3b's `useLyrics`: this
orchestrator's control flow is exercised by the device-verification
checklist (Task 8) rather than a unit test, since its two collaborators (the
ReccoBeats client and the database) are already independently tested.

- [ ] **Step 1: Write `apps/mobile/src/metadata/audioFeaturesEnrichment.ts`**

```typescript
import { searchTrack, getAudioFeatures, createThrottle } from "@aura/shared";
import type { LibraryDb } from "../library/database";

export interface AudioFeaturesEnrichmentResult {
  enriched: number;
  skipped: number;
}

const throttled = createThrottle(1000);

export async function enrichAudioFeatures(db: LibraryDb): Promise<AudioFeaturesEnrichmentResult> {
  const pending = await db.getTracksPendingAudioFeatures();
  let enriched = 0;
  let skipped = 0;

  for (const track of pending) {
    try {
      const reccobeatsId = await throttled(() =>
        searchTrack(fetch, track.title, track.artistName)
      );
      if (!reccobeatsId) {
        skipped += 1;
        continue;
      }

      const features = await throttled(() => getAudioFeatures(fetch, [reccobeatsId]));
      const trackFeatures = features.get(reccobeatsId);
      if (!trackFeatures) {
        skipped += 1;
        continue;
      }

      await db.setTrackAudioFeatures(track.id, { reccobeatsId, ...trackFeatures });
      enriched += 1;
    } catch {
      skipped += 1;
    }
  }

  return { enriched, skipped };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/metadata/audioFeaturesEnrichment.ts
git commit -m "feat(mobile): add the audio-features enrichment orchestrator"
```

---

### Task 7: Wire audio-feature enrichment into Settings, add Recommended For You to Home

**Files:**
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `enrichAudioFeatures` (Task 6); `recommendTracks` from
  `@aura/shared` (Task 4); `useLibraryStore` (existing, for favorites).
- Produces: no new exports; `handleEnrich` also runs audio-feature
  enrichment; `HomeScreen` gains a "Recommended For You" section.

- [ ] **Step 1: Extend `handleEnrich` in `SettingsScreen.tsx`**

Add the import:

```typescript
import { enrichAudioFeatures } from "../metadata/audioFeaturesEnrichment";
```

Replace the body of `handleEnrich` with:

```typescript
  async function handleEnrich() {
    setEnriching(true);
    try {
      const db = await getLibraryDb();
      const metadataResult = await enrichLibrary(db);
      const featuresResult = await enrichAudioFeatures(db);
      bumpLibraryVersion();
      const enriched = metadataResult.enriched + featuresResult.enriched;
      const skipped = metadataResult.skipped + featuresResult.skipped;
      if (enriched > 0 || skipped > 0) {
        Alert.alert(
          "Enrichment complete",
          `${enriched} item${enriched === 1 ? "" : "s"} enriched` +
            (skipped > 0 ? `, ${skipped} skipped.` : ".")
        );
      }
    } catch (error) {
      Alert.alert("Enrichment failed", "Could not fetch metadata. Please try again.");
    } finally {
      setEnriching(false);
    }
  }
```

- [ ] **Step 2: Add the "Recommended For You" section to `HomeScreen.tsx`**

Add the imports:

```typescript
import { recommendTracks } from "@aura/shared";
import { useLibraryStore } from "../store/libraryStore";
```

Add a helper above `HomeScreen` (below the existing `Section` function) that
maps a list of recommended tracks to their unique parent albums, in order:

```typescript
function albumsFromTracks(recommendedTracks: Track[], allAlbums: Album[]): Album[] {
  const albumById = new Map(allAlbums.map((album) => [album.id, album]));
  const seen = new Set<string>();
  const result: Album[] = [];
  for (const track of recommendedTracks) {
    if (seen.has(track.albumId)) continue;
    const album = albumById.get(track.albumId);
    if (album) {
      seen.add(track.albumId);
      result.push(album);
    }
  }
  return result;
}
```

Inside `HomeScreen`, add the favorites selector and the computed
recommendation section, right after the existing `hiRes` computation:

```typescript
  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);
  const favoriteTracks = tracks.filter((t) => favoriteTrackIds.has(t.id));
  const recommended = albumsFromTracks(
    recommendTracks(tracks, favoriteTracks, 10),
    albums
  );
```

Add the new section to the JSX, after the existing `"Your Heavy Rotation"`
section:

```tsx
      <Section title="Recommended For You" albums={recommended} tracks={tracks} />
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/SettingsScreen.tsx apps/mobile/src/screens/HomeScreen.tsx
git commit -m "feat(mobile): wire audio-feature enrichment and add Recommended For You"
```

---

### Task 8: Device verification handoff

**Files:** none (verification only)

- [ ] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The ReccoBeats client and the local
recommendation algorithm are fully verified against mocked HTTP responses
and hand-built feature vectors.

- [ ] **Step 2: Give the user this checklist to confirm on device**

  - Settings → Enrich Metadata: still completes without errors now that it
    also runs audio-feature enrichment (may take longer — two throttled
    services running in sequence)
  - After favoriting at least one enriched track, Home eventually shows a
    "Recommended For You" section (it stays hidden until there's at least
    one favorited track with cached audio features)
  - Every album shown in that section is genuinely playable — tapping it
    plays a real local track, not a placeholder
  - With no favorites, or before any enrichment has run, the section simply
    doesn't appear — no error, no empty placeholder
  - The app stays responsive while both enrichment passes run in the
    background

- [ ] **Step 3: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation. Do not describe real ReccoBeats matches or
recommendation quality as confirmed until the user reports back.

---

## Self-Review Notes

- **Spec coverage:** ReccoBeats client (search + features, every failure
  mode) ✓ (Task 2), the explicit decision *not* to call the recommendation
  endpoint ✓ (Global Constraints), local nearest-neighbor algorithm with
  seed-exclusion and multi-seed centroid tests ✓ (Task 3), schema + queries ✓
  (Task 5), orchestrator with per-track failure isolation and its own
  independent throttle ✓ (Task 6), Settings + Home wiring ✓ (Task 7), honest
  verification split ✓ (Task 8). `key`/`liveness`/`loudness`/`mode`/
  `speechiness` are explicitly excluded per the design doc.
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `AudioFeatures` defined once in `@aura/types` (Task
  1), reused by the ReccoBeats client (Task 2), the recommendation algorithm
  (Task 3), and the database layer (Task 5) without redefinition.
  `recommendTracks`'s parameter order (`candidates, seeds, count`) is
  consistent between its definition (Task 3) and its call site in
  `HomeScreen` (Task 7).
- **No new `LibraryDb` method breaks an existing caller:** `getAllTracks`/
  `searchTracks` gain a new optional field on their return type, not a
  signature change — every existing caller (Search, Library, playerStore)
  keeps working unchanged.
