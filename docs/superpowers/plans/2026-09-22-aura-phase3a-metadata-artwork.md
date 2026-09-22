# AURA Phase 3a Implementation Plan — Metadata + Artwork Enrichment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Enrich the locally scanned library with real MusicBrainz metadata
and real Cover Art Archive artwork, replacing the placeholder letter tiles
that have been on screen since Phase 1 — with no UI component changes, since
`ArtworkCard` already renders `artworkUrl` when present.

**Architecture:** Pure, `fetch`-injected MusicBrainz and Cover Art Archive
clients in `packages/shared`, unit-tested with mocked HTTP responses. A
shared throttle enforces ≥1 request/second across both services combined. An
orchestrator in `apps/mobile` walks albums missing a MusicBrainz ID, persists
what it finds, downloads and caches artwork via `expo-file-system`, and never
lets one album's failure stop the rest. Triggered automatically after a scan
and by a manual "Enrich Metadata" button in Settings.

**Tech Stack:** TypeScript, plain-node Jest (`packages/shared`, same setup as
the FLAC parser), `expo-file-system` (already a dependency), `expo-sqlite`
schema migration via `PRAGMA table_info` + `ALTER TABLE`.

## Global Constraints

- No API keys or secrets — MusicBrainz and Cover Art Archive are free and
  keyless. Calling them directly from the mobile app is fine; this principle
  becomes load-bearing later for authenticated providers, not here.
- MusicBrainz requests carry a descriptive `User-Agent` header identifying
  the app, per MusicBrainz's usage guidelines.
- At least 1 second between requests, enforced by one shared throttle across
  both services — not two independent limiters.
- One album's enrichment failing (no match, network error, no cover art)
  must never crash, never block the rest of the queue, and never block
  library browsing. Nothing is auto-retried.
- No change to `ArtworkCard`, `TrackRow`, or any other existing UI component.
  Enrichment only populates data those components already know how to render.
- The schema migration must be safe to run on every app launch, including
  against a database that already has the new columns (no error, no
  duplicate-column failure).

---

## File Structure

```
packages/shared/src/
├── index.ts                          (modify: export metadata APIs)
└── metadata/
    ├── musicbrainz.ts                (new)
    ├── musicbrainz.test.ts           (new)
    ├── coverArt.ts                   (new)
    ├── coverArt.test.ts              (new)
    ├── throttle.ts                   (new)
    └── throttle.test.ts              (new)

apps/mobile/src/
├── library/
│   └── database.ts                   (modify: migration + enrichment columns/methods)
├── metadata/
│   └── enrichment.ts                 (new)
├── store/
│   └── libraryVersionStore.ts        (new)
├── hooks/
│   └── useLibraryData.ts             (modify: reload on library version bump)
└── screens/
    └── SettingsScreen.tsx            (modify: auto + manual enrichment trigger)
```

---

### Task 1: `throttle` — shared rate limiter (TDD)

**Files:**
- Create: `packages/shared/src/metadata/throttle.ts`
- Test: `packages/shared/src/metadata/throttle.test.ts`

**Interfaces:**
- Produces: `createThrottle(minIntervalMs: number, deps?: { sleep?: (ms: number) => Promise<void>; now?: () => number }): <T>(fn: () => Promise<T>) => Promise<T>`.
  Consumed by `enrichment.ts` (Task 6).

- [x] **Step 1: Write the failing test**

```typescript
// packages/shared/src/metadata/throttle.test.ts
import { createThrottle } from "./throttle";

describe("createThrottle", () => {
  it("does not delay the first call", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));

    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits out the remaining interval before a call that comes too soon", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));
    currentTime = 1300;
    await throttled(() => Promise.resolve("b"));

    expect(sleep).toHaveBeenCalledWith(700);
  });

  it("does not wait if enough time has already passed", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    let currentTime = 1000;
    const now = jest.fn(() => currentTime);
    const throttled = createThrottle(1000, { sleep, now });

    await throttled(() => Promise.resolve("a"));
    currentTime = 3000;
    await throttled(() => Promise.resolve("b"));

    expect(sleep).not.toHaveBeenCalled();
  });

  it("runs calls in the order they were scheduled", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });
    const order: string[] = [];

    const p1 = throttled(async () => {
      order.push("a");
    });
    const p2 = throttled(async () => {
      order.push("b");
    });
    await Promise.all([p1, p2]);

    expect(order).toEqual(["a", "b"]);
  });

  it("continues processing later calls even if an earlier one rejects", async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const now = jest.fn().mockReturnValue(1000);
    const throttled = createThrottle(1000, { sleep, now });

    await expect(
      throttled(() => Promise.reject(new Error("boom")))
    ).rejects.toThrow("boom");
    await expect(throttled(() => Promise.resolve("ok"))).resolves.toBe("ok");
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test throttle`
Expected: FAIL — cannot find module `./throttle`.

- [x] **Step 3: Write `packages/shared/src/metadata/throttle.ts`**

```typescript
export type Sleep = (ms: number) => Promise<void>;

export interface ThrottleDeps {
  sleep?: Sleep;
  now?: () => number;
}

export function createThrottle(
  minIntervalMs: number,
  deps: ThrottleDeps = {}
): <T>(fn: () => Promise<T>) => Promise<T> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? Date.now;

  let lastCallAt: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  return function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (lastCallAt !== null) {
        const wait = Math.max(0, lastCallAt + minIntervalMs - now());
        if (wait > 0) await sleep(wait);
      }
      lastCallAt = now();
      return fn();
    };

    const scheduled = chain.then(run, run);
    chain = scheduled.then(
      () => undefined,
      () => undefined
    );
    return scheduled;
  };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test throttle`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/metadata/throttle.ts packages/shared/src/metadata/throttle.test.ts
git commit -m "feat(shared): add a shared rate-limiting throttle for metadata lookups"
```

---

### Task 2: `musicbrainz` client (TDD)

**Files:**
- Create: `packages/shared/src/metadata/musicbrainz.ts`
- Test: `packages/shared/src/metadata/musicbrainz.test.ts`

**Interfaces:**
- Produces: `FetchLike` type, `MusicBrainzReleaseMatch` interface, and
  `searchRelease(fetchFn: FetchLike, artist: string, album: string): Promise<MusicBrainzReleaseMatch | null>`.
  Consumed by `enrichment.ts` (Task 6).

- [x] **Step 1: Write the failing test**

```typescript
// packages/shared/src/metadata/musicbrainz.test.ts
import { searchRelease } from "./musicbrainz";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("searchRelease", () => {
  it("returns the release and artist MBIDs plus release date on a match", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        releases: [
          {
            id: "release-mbid-123",
            date: "2024-03-15",
            "artist-credit": [{ artist: { id: "artist-mbid-456" } }],
          },
        ],
      }),
    });

    const result = await searchRelease(fetchFn, "Nocturne Field", "Low Tide Archive");

    expect(result).toEqual({
      releaseMbid: "release-mbid-123",
      artistMbid: "artist-mbid-456",
      releaseDate: "2024-03-15",
    });
  });

  it("returns null when there are no matching releases", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ releases: [] }) });
    expect(await searchRelease(fetchFn, "Unknown Artist", "Unknown Album")).toBeNull();
  });

  it("returns null when the response is not ok", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 503 });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when a matched release has no artist credit", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({ releases: [{ id: "release-mbid-123", date: "2024" }] }),
    });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("sends a descriptive User-Agent header", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        releases: [{ id: "r1", "artist-credit": [{ artist: { id: "a1" } }] }],
      }),
    });

    await searchRelease(fetchFn, "Artist", "Album");

    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("AURA");
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test musicbrainz`
Expected: FAIL — cannot find module `./musicbrainz`.

- [x] **Step 3: Write `packages/shared/src/metadata/musicbrainz.ts`**

```typescript
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface MusicBrainzReleaseMatch {
  releaseMbid: string;
  artistMbid: string;
  releaseDate?: string;
}

const USER_AGENT = "AURA/0.0.1 (personal-use FLAC player)";

interface ReleaseSearchResponse {
  releases?: Array<{
    id?: string;
    date?: string;
    "artist-credit"?: Array<{ artist?: { id?: string } }>;
  }>;
}

export async function searchRelease(
  fetchFn: FetchLike,
  artist: string,
  album: string
): Promise<MusicBrainzReleaseMatch | null> {
  const query = `release:"${album}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=1`;

  let response;
  try {
    response = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: ReleaseSearchResponse;
  try {
    body = (await response.json()) as ReleaseSearchResponse;
  } catch {
    return null;
  }

  const release = body.releases?.[0];
  const artistMbid = release?.["artist-credit"]?.[0]?.artist?.id;
  if (!release?.id || !artistMbid) return null;

  return {
    releaseMbid: release.id,
    artistMbid,
    releaseDate: release.date,
  };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test musicbrainz`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/metadata/musicbrainz.ts packages/shared/src/metadata/musicbrainz.test.ts
git commit -m "feat(shared): add MusicBrainz release lookup client"
```

---

### Task 3: `coverArt` client (TDD)

**Files:**
- Create: `packages/shared/src/metadata/coverArt.ts`
- Test: `packages/shared/src/metadata/coverArt.test.ts`

**Interfaces:**
- Consumes: `FetchLike` (Task 2).
- Produces: `getFrontCoverUrl(fetchFn: FetchLike, releaseMbid: string): Promise<string | null>`.
  Consumed by `enrichment.ts` (Task 6).

- [x] **Step 1: Write the failing test**

```typescript
// packages/shared/src/metadata/coverArt.test.ts
import { getFrontCoverUrl } from "./coverArt";

describe("getFrontCoverUrl", () => {
  it("returns the front cover URL when art exists", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    const url = await getFrontCoverUrl(fetchFn, "release-mbid-123");

    expect(url).toBe("https://coverartarchive.org/release/release-mbid-123/front");
  });

  it("returns null when there is no cover art (404)", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await getFrontCoverUrl(fetchFn, "release-mbid-123")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await getFrontCoverUrl(fetchFn, "release-mbid-123")).toBeNull();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test coverArt`
Expected: FAIL — cannot find module `./coverArt`.

- [x] **Step 3: Write `packages/shared/src/metadata/coverArt.ts`**

```typescript
import type { FetchLike } from "./musicbrainz";

export async function getFrontCoverUrl(
  fetchFn: FetchLike,
  releaseMbid: string
): Promise<string | null> {
  const url = `https://coverartarchive.org/release/${releaseMbid}/front`;

  let response;
  try {
    response = await fetchFn(url, { headers: { Accept: "image/*" } });
  } catch {
    return null;
  }

  return response.ok ? url : null;
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test coverArt`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add packages/shared/src/metadata/coverArt.ts packages/shared/src/metadata/coverArt.test.ts
git commit -m "feat(shared): add Cover Art Archive front-cover lookup client"
```

---

### Task 4: Export the metadata APIs from `@aura/shared`

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `searchRelease`, `getFrontCoverUrl`, `createThrottle` and their
  types, re-exported from `@aura/shared`. Consumed by `enrichment.ts` (Task 6).

- [x] **Step 1: Add the exports**

Append to `packages/shared/src/index.ts`:

```typescript
export { searchRelease } from "./metadata/musicbrainz";
export type { FetchLike, MusicBrainzReleaseMatch } from "./metadata/musicbrainz";
export { getFrontCoverUrl } from "./metadata/coverArt";
export { createThrottle } from "./metadata/throttle";
export type { Sleep, ThrottleDeps } from "./metadata/throttle";
```

- [x] **Step 2: Run the whole shared suite**

Run: `pnpm --filter @aura/shared test`
Expected: PASS (37 tests — 22 from Phase 2a plus 15 new).

- [x] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export the metadata enrichment APIs"
```

---

### Task 5: Database migration and enrichment columns/methods (TDD for the migration logic)

**Files:**
- Modify: `apps/mobile/src/library/database.ts`
- Test: `apps/mobile/src/library/migration.test.ts`

**Interfaces:**
- Produces: an exported `ensureColumn(db, table, column, ddlType)` helper
  (structurally typed against `{ getAllAsync, execAsync }` so it's testable
  without a real SQLite engine), called from `openLibrary()`. Extends
  `LibraryDb` with `getAlbumsPendingEnrichment(): Promise<AlbumPendingEnrichment[]>`,
  `setAlbumEnrichment(albumId, data): Promise<void>`,
  `setArtistMusicBrainzId(artistId, musicbrainzId): Promise<void>`. `getAlbums()`
  now also returns `artworkUrl`/`releaseDate` when present. Consumed by
  `enrichment.ts` (Task 6).

- [x] **Step 1: Write the failing test for the migration helper**

```typescript
// apps/mobile/src/library/migration.test.ts
import { ensureColumn } from "./database";

interface FakeDb {
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
}

function fakeDb(existingColumns: string[]): FakeDb {
  return {
    getAllAsync: jest.fn().mockResolvedValue(existingColumns.map((name) => ({ name }))),
    execAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe("ensureColumn", () => {
  it("adds the column when it is missing", async () => {
    const db = fakeDb(["id", "title"]);
    await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
    expect(db.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE albums ADD COLUMN musicbrainz_id TEXT"
    );
  });

  it("does nothing when the column already exists", async () => {
    const db = fakeDb(["id", "title", "musicbrainz_id"]);
    await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
    expect(db.execAsync).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/mobile test migration`
Expected: FAIL — `ensureColumn` is not exported from `./database`.

- [x] **Step 3: Add the migration helper, schema columns, and new methods to `database.ts`**

Add the migration helper near the top of the file, after the `SCHEMA` constant:

```typescript
interface MigratableDb {
  getAllAsync<T>(sql: string): Promise<T[]>;
  execAsync(sql: string): Promise<unknown>;
}

export async function ensureColumn(
  db: MigratableDb,
  table: string,
  column: string,
  ddlType: string
): Promise<void> {
  const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!existing.some((col) => col.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
  }
}
```

Add `AlbumPendingEnrichment` next to `ScannedTrack`:

```typescript
export interface AlbumPendingEnrichment {
  id: string;
  artistId: string;
  title: string;
  artistName: string;
}
```

Extend the `LibraryDb` interface:

```typescript
export interface LibraryDb {
  upsertScannedTrack(input: ScannedTrack): Promise<void>;
  getAllTracks(): Promise<Track[]>;
  getAlbums(): Promise<Album[]>;
  getArtists(): Promise<Artist[]>;
  searchTracks(query: string): Promise<Track[]>;
  setFavorite(trackId: string, isFavorite: boolean): Promise<void>;
  getFavoriteIds(): Promise<string[]>;
  clearLibrary(): Promise<void>;
  getAlbumsPendingEnrichment(): Promise<AlbumPendingEnrichment[]>;
  setAlbumEnrichment(
    albumId: string,
    data: { musicbrainzId: string; releaseDate?: string; artworkUrl?: string }
  ): Promise<void>;
  setArtistMusicBrainzId(artistId: string, musicbrainzId: string): Promise<void>;
}
```

In `openLibrary()`, call the migration right after `await db.execAsync(SCHEMA);`:

```typescript
  await db.execAsync(SCHEMA);
  await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
  await ensureColumn(db, "albums", "release_date", "TEXT");
  await ensureColumn(db, "albums", "artwork_url", "TEXT");
  await ensureColumn(db, "artists", "musicbrainz_id", "TEXT");
```

Update `getAlbums()` to select and map the new columns:

```typescript
    async getAlbums() {
      const rows = await db.getAllAsync<{
        id: string;
        title: string;
        artist_id: string;
        artist_name: string;
        release_date: string | null;
        artwork_url: string | null;
      }>(
        `SELECT albums.id, albums.title, albums.artist_id, albums.release_date, albums.artwork_url,
                artists.name AS artist_name
         FROM albums JOIN artists ON artists.id = albums.artist_id
         ORDER BY albums.title`
      );
      const albums: Album[] = [];
      for (const row of rows) {
        const trackIds = await db.getAllAsync<{ id: string }>(
          "SELECT id FROM tracks WHERE album_id = ? ORDER BY track_number, title",
          row.id
        );
        const album: Album = {
          id: row.id,
          title: row.title,
          artistId: row.artist_id,
          artistName: row.artist_name,
          trackIds: trackIds.map((t) => t.id),
        };
        if (row.release_date) album.releaseDate = row.release_date;
        if (row.artwork_url) album.artworkUrl = row.artwork_url;
        albums.push(album);
      }
      return albums;
    },
```

Add the three new methods next to `clearLibrary`:

```typescript
    async getAlbumsPendingEnrichment() {
      const rows = await db.getAllAsync<{
        id: string;
        artist_id: string;
        title: string;
        artist_name: string;
      }>(
        `SELECT albums.id, albums.artist_id, albums.title, artists.name AS artist_name
         FROM albums JOIN artists ON artists.id = albums.artist_id
         WHERE albums.musicbrainz_id IS NULL`
      );
      return rows.map(
        (row): AlbumPendingEnrichment => ({
          id: row.id,
          artistId: row.artist_id,
          title: row.title,
          artistName: row.artist_name,
        })
      );
    },

    async setAlbumEnrichment(albumId, data) {
      await db.runAsync(
        "UPDATE albums SET musicbrainz_id = ?, release_date = ?, artwork_url = ? WHERE id = ?",
        data.musicbrainzId,
        data.releaseDate ?? null,
        data.artworkUrl ?? null,
        albumId
      );
    },

    async setArtistMusicBrainzId(artistId, musicbrainzId) {
      await db.runAsync(
        "UPDATE artists SET musicbrainz_id = ? WHERE id = ?",
        musicbrainzId,
        artistId
      );
    },
```

- [x] **Step 4: Run to verify the migration test passes**

Run: `pnpm --filter @aura/mobile test migration`
Expected: PASS (2 tests).

- [x] **Step 5: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 6: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions in the existing suites.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/library/database.ts apps/mobile/src/library/migration.test.ts
git commit -m "feat(mobile): add enrichment columns, a safe migration, and pending-enrichment queries"
```

---

### Task 6: Enrichment orchestrator

**Files:**
- Create: `apps/mobile/src/metadata/enrichment.ts`

**Interfaces:**
- Consumes: `searchRelease`, `getFrontCoverUrl`, `createThrottle` from
  `@aura/shared` (Tasks 1-4); `LibraryDb`, `AlbumPendingEnrichment` from
  `../library/database` (Task 5).
- Produces: `enrichLibrary(db: LibraryDb): Promise<{ enriched: number; skipped: number }>`,
  consumed by `SettingsScreen` (Task 8).

This orchestrator's control flow (proceed on success, skip on failure, never
throw past a single album) is exercised by the device-verification checklist
in Task 9 rather than a unit test — its two collaborators (the network
clients and the database) are already independently tested, and mocking both
`fetch` and `expo-file-system` together to unit-test this file's own logic
would mostly be re-testing Jest mocks rather than real behavior, the same
judgment call made for `scanner.ts` in Phase 2a.

- [x] **Step 1: Write `apps/mobile/src/metadata/enrichment.ts`**

```typescript
import * as FileSystem from "expo-file-system";
import { searchRelease, getFrontCoverUrl, createThrottle } from "@aura/shared";
import type { LibraryDb } from "../library/database";

export interface EnrichmentResult {
  enriched: number;
  skipped: number;
}

const throttled = createThrottle(1000);

async function cacheArtwork(url: string, releaseMbid: string): Promise<string | undefined> {
  try {
    const dir = `${FileSystem.cacheDirectory}artwork/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const dest = `${dir}${releaseMbid}.jpg`;
    const result = await FileSystem.downloadAsync(url, dest);
    return result.status === 200 ? result.uri : undefined;
  } catch {
    return undefined;
  }
}

export async function enrichLibrary(db: LibraryDb): Promise<EnrichmentResult> {
  const pending = await db.getAlbumsPendingEnrichment();
  let enriched = 0;
  let skipped = 0;

  for (const album of pending) {
    try {
      const match = await throttled(() => searchRelease(fetch, album.artistName, album.title));
      if (!match) {
        skipped += 1;
        continue;
      }

      let artworkUrl: string | undefined;
      const coverUrl = await throttled(() => getFrontCoverUrl(fetch, match.releaseMbid));
      if (coverUrl) {
        artworkUrl = await cacheArtwork(coverUrl, match.releaseMbid);
      }

      await db.setAlbumEnrichment(album.id, {
        musicbrainzId: match.releaseMbid,
        releaseDate: match.releaseDate,
        artworkUrl,
      });
      await db.setArtistMusicBrainzId(album.artistId, match.artistMbid);
      enriched += 1;
    } catch {
      skipped += 1;
    }
  }

  return { enriched, skipped };
}
```

- [x] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 3: Commit**

```bash
git add apps/mobile/src/metadata/enrichment.ts
git commit -m "feat(mobile): add the metadata/artwork enrichment orchestrator"
```

---

### Task 7: Reactive library reload

**Files:**
- Create: `apps/mobile/src/store/libraryVersionStore.ts`
- Modify: `apps/mobile/src/hooks/useLibraryData.ts`

**Interfaces:**
- Produces: `useLibraryVersionStore` with `{ version: number; bump: () => void }`.
  `useLibraryData` now re-fetches whenever `version` changes. Consumed by
  `SettingsScreen` (Task 8) to make scan/enrichment results actually appear
  on Home and Library without the user needing to navigate away and back.

Without this, Task 8's "scan complete" and "enrichment complete" would be
invisible on screen until the user happened to remount `HomeScreen` or
`LibraryScreen` — the whole point of this phase (seeing real artwork appear)
would go unobserved.

- [x] **Step 1: Write `apps/mobile/src/store/libraryVersionStore.ts`**

```typescript
import { create } from "zustand";

interface LibraryVersionState {
  version: number;
  bump: () => void;
}

export const useLibraryVersionStore = create<LibraryVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
```

- [x] **Step 2: Modify `apps/mobile/src/hooks/useLibraryData.ts`**

Add the import and subscribe to `version`, including it in the reload effect's
dependency array:

```typescript
import { useCallback, useEffect, useState } from "react";
import type { Album, Track } from "@aura/types";
import { getLibraryDb } from "../providers";
import { useLibraryVersionStore } from "../store/libraryVersionStore";

export function useLibraryData() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const version = useLibraryVersionStore((s) => s.version);

  const reload = useCallback(() => {
    setLoading(true);
    void getLibraryDb()
      .then(async (db) => {
        const [nextTracks, nextAlbums] = await Promise.all([
          db.getAllTracks(),
          db.getAlbums(),
        ]);
        setTracks(nextTracks);
        setAlbums(nextAlbums);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload, version]);

  return { tracks, albums, loading, reload };
}
```

- [x] **Step 3: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 4: Commit**

```bash
git add apps/mobile/src/store/libraryVersionStore.ts apps/mobile/src/hooks/useLibraryData.ts
git commit -m "feat(mobile): make Home/Library reactively reload after scan or enrichment"
```

---

### Task 8: Wire enrichment into Settings

**Files:**
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `enrichLibrary` (Task 6), `useLibraryVersionStore` (Task 7).
- Produces: no new exports; `handleScan` chains into enrichment after a
  successful scan, and a new "Enrich Metadata" button allows a manual re-run.

- [x] **Step 1: Add the imports**

```typescript
import { enrichLibrary } from "../metadata/enrichment";
import { useLibraryVersionStore } from "../store/libraryVersionStore";
```

- [x] **Step 2: Add an `enriching` state and the bump call, alongside the
  existing `scanning` state**

```typescript
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);
  const bumpLibraryVersion = useLibraryVersionStore((s) => s.bump);
```

- [x] **Step 3: Chain enrichment into `handleScan`, and add `handleEnrich`**

Replace the existing `handleScan` function with:

```typescript
  async function handleScan() {
    setScanning(true);
    try {
      const db = await getLibraryDb();
      const result = await scanMusicFolder(db);
      if (!result.cancelled) {
        hydrateFavorites();
        bumpLibraryVersion();
        Alert.alert(
          "Scan complete",
          `${result.imported} file${result.imported === 1 ? "" : "s"} imported` +
            (result.unreadable > 0
              ? `, ${result.unreadable} could not be read and are listed as Unknown quality.`
              : ".")
        );
        void handleEnrich();
      }
    } catch (error) {
      Alert.alert("Scan failed", "Could not read that folder. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const db = await getLibraryDb();
      const result = await enrichLibrary(db);
      bumpLibraryVersion();
      if (result.enriched > 0 || result.skipped > 0) {
        Alert.alert(
          "Enrichment complete",
          `${result.enriched} album${result.enriched === 1 ? "" : "s"} enriched` +
            (result.skipped > 0 ? `, ${result.skipped} skipped.` : ".")
        );
      }
    } catch (error) {
      Alert.alert("Enrichment failed", "Could not fetch metadata. Please try again.");
    } finally {
      setEnriching(false);
    }
  }
```

(`handleScan`'s auto-trigger doesn't await `handleEnrich`, so the "Scan
complete" alert appears immediately and enrichment continues in the
background, per the approved design.)

- [x] **Step 4: Add the "Enrich Metadata" button next to "Scan Music Folder"**

```tsx
      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>LIBRARY</Text>
        <Pressable style={styles.row} onPress={handleScan} disabled={scanning}>
          <Text style={typography.body}>
            {scanning ? "Scanning…" : "Scan Music Folder"}
          </Text>
        </Pressable>
        <Pressable style={styles.row} onPress={handleEnrich} disabled={enriching}>
          <Text style={typography.body}>
            {enriching ? "Enriching…" : "Enrich Metadata"}
          </Text>
        </Pressable>
      </View>
```

(This replaces the existing single-`Pressable` `LIBRARY` group with the two
rows above.)

- [x] **Step 5: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 6: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions.

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/SettingsScreen.tsx
git commit -m "feat(mobile): trigger metadata enrichment after scan and on demand"
```

---

### Task 9: Device verification handoff

**Files:** none (verification only)

- [x] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The MusicBrainz client, the Cover Art Archive
client, the throttle, and the migration helper are all verified against
mocked HTTP/DB responses.

- [x] **Step 2: Give the user this checklist to confirm on device**

  - Settings → Scan Music Folder, then wait: an "Enrichment complete" alert
    eventually appears (may take a while for a large library — 1 request/sec
    per album)
  - Home and Library show real album artwork in place of the letter-tile
    placeholders for albums MusicBrainz found a match for
  - An album MusicBrainz has no match for keeps its placeholder tile and
    doesn't error
  - Tapping "Enrich Metadata" again re-runs cleanly (no duplicate-column or
    other migration errors on a second app launch)
  - The app remains fully usable (scrolling, playback, search) while
    enrichment runs in the background

- [x] **Step 3: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation. Do not describe real enrichment results or artwork
rendering as confirmed until the user reports back.

---

## Self-Review Notes

- **Spec coverage:** MusicBrainz client with real failure-mode tests ✓
  (Task 2), Cover Art Archive client ✓ (Task 3), shared throttle ✓ (Task 1),
  safe migration ✓ (Task 5), orchestrator with per-album failure isolation ✓
  (Task 6), auto-trigger after scan + manual re-run ✓ (Task 8), reactive UI
  update — a gap that would otherwise make this phase's entire payoff
  invisible — ✓ (Task 7), honest verification split ✓ (Task 9). Genre/tags
  and artist artwork are explicitly out of scope per the design doc (no
  screen displays them).
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `FetchLike` defined once in `musicbrainz.ts`, reused
  by `coverArt.ts` via `import type`. `AlbumPendingEnrichment` defined once in
  `database.ts`, consumed by `enrichment.ts`. `LibraryDb`'s three new methods
  use identical names and signatures between the interface declaration and
  the `openLibrary()` implementation.
- **No `@aura/types` changes needed:** `Album` already has optional
  `artworkUrl`/`releaseDate` fields from Phase 1, unused until now — this
  phase populates them rather than adding new ones.
