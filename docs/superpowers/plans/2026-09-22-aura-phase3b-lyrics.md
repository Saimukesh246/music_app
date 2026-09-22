# AURA Phase 3b Implementation Plan — LRCLIB Lyrics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synchronized and plain lyrics to Now Playing, sourced from
LRCLIB, cached in SQLite, toggled in place of the artwork square — no new
screen, no new navigation route.

**Architecture:** A pure LRC parser and a pure, `fetch`-injected LRCLIB
client in `packages/shared`, unit-tested with mocked HTTP responses (same
pattern as 3a). A new `lyrics` SQLite table caches successful matches. A
`useLyrics` hook checks the cache, falls back to the network, and never
touches `playerStore` — so fetching is structurally incapable of blocking
playback. A `LyricsView` component renders the four possible states
(loading, instrumental, unavailable, ready) and auto-scrolls synced lines
against live playback position.

**Tech Stack:** TypeScript, plain-node Jest (`packages/shared`), the
existing `expo-sqlite` database.

## Global Constraints

- Duration sent to LRCLIB is rounded to the nearest second, per LRCLIB's
  requirement that it match within ±2 seconds of their record.
- A 404 (no match), any other non-200, a network error, and a malformed body
  all resolve to `null` from the client — never thrown, never distinguished
  by the caller.
- Requests carry a descriptive `User-Agent`, same format and reasoning as
  3a's MusicBrainz client.
- Only successful matches (including instrumental — a stable, definitive
  fact) are cached. A "not found" result is never cached, since LRCLIB's own
  docs note missing tracks can be added later.
- No persistent throttle for this phase — lyrics fetch one track at a time,
  on demand, not in a batch like 3a's enrichment.
- No change to `MiniPlayer`, Home, Search, Library, or Settings. Only
  `NowPlayingScreen` changes, by adding one toggle button.
- The lyrics fetch must never read from or write to `playerStore` — that is
  what guarantees it cannot block or interfere with playback.

---

## File Structure

```
packages/shared/src/
├── index.ts                        (modify: export lyrics APIs)
└── lyrics/
    ├── lrc.ts                      (new)
    ├── lrc.test.ts                 (new)
    ├── lrclib.ts                   (new)
    └── lrclib.test.ts              (new)

apps/mobile/src/
├── library/
│   └── database.ts                 (modify: lyrics table + 2 methods)
├── hooks/
│   └── useLyrics.ts                 (new)
├── components/
│   └── LyricsView.tsx               (new)
└── screens/
    └── NowPlayingScreen.tsx         (modify: lyrics toggle)
```

---

### Task 1: `parseLrc` — LRC format parser (TDD)

**Files:**
- Create: `packages/shared/src/lyrics/lrc.ts`
- Test: `packages/shared/src/lyrics/lrc.test.ts`

**Interfaces:**
- Produces: `LyricLine` interface and `parseLrc(text: string): LyricLine[]`.
  Consumed by `useLyrics` (Task 5).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/lyrics/lrc.test.ts
import { parseLrc } from "./lrc";

describe("parseLrc", () => {
  it("parses a single timestamp per line", () => {
    const lrc = "[00:12.34]First line\n[00:17.50]Second line";
    expect(parseLrc(lrc)).toEqual([
      { timeSec: 12.34, text: "First line" },
      { timeSec: 17.5, text: "Second line" },
    ]);
  });

  it("supports a colon as the fractional-second separator", () => {
    const lrc = "[00:12:34]Colon variant";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 12.34, text: "Colon variant" }]);
  });

  it("expands multiple timestamps on one line into separate entries", () => {
    const lrc = "[00:10.00][00:40.00]Repeated chorus";
    expect(parseLrc(lrc)).toEqual([
      { timeSec: 10, text: "Repeated chorus" },
      { timeSec: 40, text: "Repeated chorus" },
    ]);
  });

  it("ignores metadata tags that are not timestamps", () => {
    const lrc = "[ar:Some Artist]\n[ti:Some Title]\n[00:05.00]Actual lyric";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 5, text: "Actual lyric" }]);
  });

  it("handles minutes beyond 59 correctly", () => {
    const lrc = "[75:30.00]Long track line";
    expect(parseLrc(lrc)).toEqual([{ timeSec: 75 * 60 + 30, text: "Long track line" }]);
  });

  it("returns lines sorted by time", () => {
    const lrc = "[00:30.00]Later\n[00:10.00]Earlier";
    expect(parseLrc(lrc).map((l) => l.text)).toEqual(["Earlier", "Later"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseLrc("")).toEqual([]);
  });

  it("returns an empty array when there are no timestamped lines", () => {
    expect(parseLrc("[ar:Artist]\n[ti:Title]")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test lrc`
Expected: FAIL — cannot find module `./lrc`.

- [ ] **Step 3: Write `packages/shared/src/lyrics/lrc.ts`**

```typescript
export interface LyricLine {
  timeSec: number;
  text: string;
}

const TIMESTAMP = /\[(\d+):(\d+)[.:](\d+)\]/g;

export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const rawLine of text.split("\n")) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP)];
    if (timestamps.length === 0) continue;

    const lineText = rawLine.replace(TIMESTAMP, "").trim();

    for (const match of timestamps) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = parseInt(match[3], 10);
      const timeSec = minutes * 60 + seconds + fraction / 100;
      lines.push({ timeSec, text: lineText });
    }
  }

  return lines.sort((a, b) => a.timeSec - b.timeSec);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test lrc`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/lyrics/lrc.ts packages/shared/src/lyrics/lrc.test.ts
git commit -m "feat(shared): add a pure LRC lyrics format parser"
```

---

### Task 2: `getLyrics` — LRCLIB client (TDD)

**Files:**
- Create: `packages/shared/src/lyrics/lrclib.ts`
- Test: `packages/shared/src/lyrics/lrclib.test.ts`

**Interfaces:**
- Consumes: `FetchLike` from `../metadata/musicbrainz` (Phase 3a — reused, not
  redefined).
- Produces: `LyricsMatch` interface and
  `getLyrics(fetchFn: FetchLike, input: { trackName: string; artistName: string; albumName?: string; durationSec: number }): Promise<LyricsMatch | null>`.
  Consumed by `useLyrics` (Task 5).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/lyrics/lrclib.test.ts
import { getLyrics } from "./lrclib";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("getLyrics", () => {
  it("returns plain and synced lyrics on a match", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        instrumental: false,
        plainLyrics: "Line one\nLine two",
        syncedLyrics: "[00:01.00]Line one\n[00:05.00]Line two",
      }),
    });

    const result = await getLyrics(fetchFn, {
      trackName: "Low Tide",
      artistName: "Nocturne Field",
      albumName: "Low Tide Archive",
      durationSec: 272.4,
    });

    expect(result).toEqual({
      plainLyrics: "Line one\nLine two",
      syncedLyrics: "[00:01.00]Line one\n[00:05.00]Line two",
      instrumental: false,
    });
  });

  it("returns instrumental: true with no lyrics text", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: true }) });

    const result = await getLyrics(fetchFn, {
      trackName: "Interlude",
      artistName: "Nocturne Field",
      durationSec: 90,
    });

    expect(result).toEqual({ instrumental: true, plainLyrics: undefined, syncedLyrics: undefined });
  });

  it("returns null on a 404 (no match)", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 404 });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null on any other non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 429 });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("rounds the duration and sends it as a query parameter", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: false }) });

    await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 272.6 });

    const [url] = fetchFn.mock.calls[0];
    expect(url).toContain("duration=273");
  });

  it("sends a descriptive User-Agent header", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: false }) });

    await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 });

    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("AURA");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test lrclib`
Expected: FAIL — cannot find module `./lrclib`.

- [ ] **Step 3: Write `packages/shared/src/lyrics/lrclib.ts`**

```typescript
import type { FetchLike } from "../metadata/musicbrainz";

export interface LyricsMatch {
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental: boolean;
}

export interface GetLyricsInput {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSec: number;
}

const USER_AGENT = "AURA/0.0.1 (personal-use FLAC player)";

interface LrclibResponse {
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export async function getLyrics(
  fetchFn: FetchLike,
  input: GetLyricsInput
): Promise<LyricsMatch | null> {
  const params = new URLSearchParams({
    track_name: input.trackName,
    artist_name: input.artistName,
    duration: String(Math.round(input.durationSec)),
  });
  if (input.albumName) params.set("album_name", input.albumName);

  const url = `https://lrclib.net/api/get?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: LrclibResponse;
  try {
    body = (await response.json()) as LrclibResponse;
  } catch {
    return null;
  }

  return {
    plainLyrics: body.plainLyrics,
    syncedLyrics: body.syncedLyrics,
    instrumental: body.instrumental ?? false,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test lrclib`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/lyrics/lrclib.ts packages/shared/src/lyrics/lrclib.test.ts
git commit -m "feat(shared): add LRCLIB lyrics lookup client"
```

---

### Task 3: Export the lyrics APIs from `@aura/shared`

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `parseLrc`, `getLyrics` and their types, re-exported from
  `@aura/shared`. Consumed by `useLyrics` (Task 5).

- [ ] **Step 1: Add the exports**

Append to `packages/shared/src/index.ts`:

```typescript
export { parseLrc } from "./lyrics/lrc";
export type { LyricLine } from "./lyrics/lrc";
export { getLyrics } from "./lyrics/lrclib";
export type { LyricsMatch, GetLyricsInput } from "./lyrics/lrclib";
```

- [ ] **Step 2: Run the whole shared suite**

Run: `pnpm --filter @aura/shared test`
Expected: PASS (53 tests — 37 from Phase 3a plus 16 new).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export the lyrics APIs"
```

---

### Task 4: Lyrics cache table and database methods

**Files:**
- Modify: `apps/mobile/src/library/database.ts`

**Interfaces:**
- Produces: `getCachedLyrics(trackId: string): Promise<{ plainLyrics?: string; syncedLyrics?: string; instrumental: boolean } | null>`
  and `cacheLyrics(trackId: string, data: { plainLyrics?: string; syncedLyrics?: string; instrumental: boolean }): Promise<void>`
  on `LibraryDb`. Consumed by `useLyrics` (Task 5).

- [ ] **Step 1: Add the `lyrics` table to `SCHEMA`**

In `apps/mobile/src/library/database.ts`, add this table to the `SCHEMA`
string, right after the `playlist_tracks` table definition and before the
`CREATE INDEX` lines:

```sql
CREATE TABLE IF NOT EXISTS lyrics (
  track_id      TEXT PRIMARY KEY NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  plain_lyrics  TEXT,
  synced_lyrics TEXT,
  instrumental  INTEGER NOT NULL DEFAULT 0
);
```

This is a new table, so it needs no `ensureColumn` migration — only columns
added to an already-existing table need that (as Phase 3a's `albums` columns
did).

- [ ] **Step 2: Extend the `LibraryDb` interface**

Add these two methods to the `LibraryDb` interface, after
`setArtistMusicBrainzId`:

```typescript
  getCachedLyrics(
    trackId: string
  ): Promise<{ plainLyrics?: string; syncedLyrics?: string; instrumental: boolean } | null>;
  cacheLyrics(
    trackId: string,
    data: { plainLyrics?: string; syncedLyrics?: string; instrumental: boolean }
  ): Promise<void>;
```

- [ ] **Step 3: Implement the methods**

Add these two methods to the object returned from `openLibrary()`, after
`setArtistMusicBrainzId`:

```typescript
    async getCachedLyrics(trackId) {
      const row = await db.getFirstAsync<{
        plain_lyrics: string | null;
        synced_lyrics: string | null;
        instrumental: number;
      }>("SELECT plain_lyrics, synced_lyrics, instrumental FROM lyrics WHERE track_id = ?", trackId);
      if (!row) return null;
      return {
        plainLyrics: row.plain_lyrics ?? undefined,
        syncedLyrics: row.synced_lyrics ?? undefined,
        instrumental: row.instrumental === 1,
      };
    },

    async cacheLyrics(trackId, data) {
      await db.runAsync(
        `INSERT INTO lyrics (track_id, plain_lyrics, synced_lyrics, instrumental)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(track_id) DO UPDATE SET
           plain_lyrics = excluded.plain_lyrics,
           synced_lyrics = excluded.synced_lyrics,
           instrumental = excluded.instrumental`,
        trackId,
        data.plainLyrics ?? null,
        data.syncedLyrics ?? null,
        data.instrumental ? 1 : 0
      );
    },
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions (the existing `migration.test.ts` only
exercises `ensureColumn`, unaffected by this new table).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/library/database.ts
git commit -m "feat(mobile): add a lyrics cache table and its query methods"
```

---

### Task 5: `useLyrics` hook

**Files:**
- Create: `apps/mobile/src/hooks/useLyrics.ts`

**Interfaces:**
- Consumes: `getLyrics`, `parseLrc`, `LyricLine` from `@aura/shared`
  (Task 3); `getLibraryDb` from `../providers`; `Track` from `@aura/types`.
- Produces: `useLyrics(track: Track | null): { status: "loading" | "ready" | "unavailable" | "instrumental"; plainLyrics?: string; syncedLines?: LyricLine[] }`.
  Consumed by `NowPlayingScreen` (Task 7).

This hook's fetch-then-cache flow is exercised by the device-verification
checklist in Task 8 rather than a unit test — like `scanner.ts` (Phase 2a)
and `enrichment.ts` (Phase 3a), its two collaborators (the LRCLIB client and
the database) are already independently tested, and this file is glue
between them plus React state, not logic worth re-mocking both dependencies
to exercise.

- [ ] **Step 1: Write `apps/mobile/src/hooks/useLyrics.ts`**

```typescript
import { useEffect, useState } from "react";
import type { Track } from "@aura/types";
import { getLyrics, parseLrc, type LyricLine } from "@aura/shared";
import { getLibraryDb } from "../providers";

export type LyricsStatus = "loading" | "ready" | "unavailable" | "instrumental";

export interface LyricsState {
  status: LyricsStatus;
  plainLyrics?: string;
  syncedLines?: LyricLine[];
}

interface CachedOrFetchedLyrics {
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental: boolean;
}

function toState(data: CachedOrFetchedLyrics): LyricsState {
  if (data.instrumental) return { status: "instrumental" };
  return {
    status: "ready",
    plainLyrics: data.plainLyrics,
    syncedLines: data.syncedLyrics ? parseLrc(data.syncedLyrics) : undefined,
  };
}

export function useLyrics(track: Track | null): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: "loading" });

  useEffect(() => {
    if (!track) {
      setState({ status: "unavailable" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      const db = await getLibraryDb();
      const cached = await db.getCachedLyrics(track.id);
      if (cached) {
        if (!cancelled) setState(toState(cached));
        return;
      }

      const result = await getLyrics(fetch, {
        trackName: track.title,
        artistName: track.artistName,
        albumName: track.albumTitle,
        durationSec: track.quality.durationSec,
      });

      if (cancelled) return;

      if (!result) {
        setState({ status: "unavailable" });
        return;
      }

      await db.cacheLyrics(track.id, result);
      if (!cancelled) setState(toState(result));
    })();

    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  return state;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useLyrics.ts
git commit -m "feat(mobile): add useLyrics, a cache-then-network lyrics hook"
```

---

### Task 6: `LyricsView` component

**Files:**
- Create: `apps/mobile/src/components/LyricsView.tsx`

**Interfaces:**
- Consumes: `LyricsStatus`, `LyricLine` (Task 5); `colors`, `spacing`,
  `radii`, `typography` from `../theme/tokens`.
- Produces: `LyricsView` with props
  `{ status: LyricsStatus; plainLyrics?: string; syncedLines?: LyricLine[]; positionSec: number }`,
  consumed by `NowPlayingScreen` (Task 7).

- [ ] **Step 1: Write `apps/mobile/src/components/LyricsView.tsx`**

```tsx
import { useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { LyricLine } from "@aura/shared";
import { colors, spacing, radii, typography } from "../theme/tokens";
import type { LyricsStatus } from "../hooks/useLyrics";

interface LyricsViewProps {
  status: LyricsStatus;
  plainLyrics?: string;
  syncedLines?: LyricLine[];
  positionSec: number;
}

const LINE_HEIGHT = 28;

function findActiveIndex(lines: LyricLine[], positionSec: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec <= positionSec) index = i;
    else break;
  }
  return index;
}

export function LyricsView({ status, plainLyrics, syncedLines, positionSec }: LyricsViewProps) {
  const scrollRef = useRef<ScrollView>(null);

  const activeIndex = useMemo(
    () => (syncedLines ? findActiveIndex(syncedLines, positionSec) : -1),
    [syncedLines, positionSec]
  );

  useEffect(() => {
    if (activeIndex < 0) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, activeIndex * LINE_HEIGHT - LINE_HEIGHT * 3),
      animated: true,
    });
  }, [activeIndex]);

  if (status === "loading") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Loading lyrics…</Text>
      </View>
    );
  }

  if (status === "instrumental") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Instrumental — no lyrics</Text>
      </View>
    );
  }

  if (status === "unavailable") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Lyrics unavailable</Text>
      </View>
    );
  }

  if (syncedLines && syncedLines.length > 0) {
    return (
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.padded}>
        {syncedLines.map((line, index) => (
          <Text
            key={`${line.timeSec}-${index}`}
            style={[
              typography.body,
              styles.syncedLine,
              index === activeIndex && { color: colors.accent },
            ]}
          >
            {line.text || " "}
          </Text>
        ))}
      </ScrollView>
    );
  }

  if (plainLyrics) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.padded}>
        <Text style={typography.body}>{plainLyrics}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.centered]}>
      <Text style={typography.caption}>Lyrics unavailable</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  padded: {
    padding: spacing.md,
  },
  syncedLine: {
    lineHeight: LINE_HEIGHT,
    color: colors.textSecondary,
  },
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/LyricsView.tsx
git commit -m "feat(mobile): add LyricsView with loading/instrumental/unavailable/ready states"
```

---

### Task 7: Wire the lyrics toggle into Now Playing

**Files:**
- Modify: `apps/mobile/src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- Consumes: `useLyrics` (Task 5), `LyricsView` (Task 6).
- Produces: no new exports; adds a "Lyrics" toggle button that swaps the
  artwork square for `LyricsView` in place.

- [ ] **Step 1: Add the imports**

```typescript
import { useState } from "react";
import { useLyrics } from "../hooks/useLyrics";
import { LyricsView } from "../components/LyricsView";
```

- [ ] **Step 2: Call the hook and add toggle state**

Add these lines inside `NowPlayingScreen`, alongside the existing
`usePlayerStore`/`useLibraryStore` calls:

```typescript
  const [showLyrics, setShowLyrics] = useState(false);
  const lyrics = useLyrics(currentTrack);
```

(`currentTrack` is still `null`-checked further down by the existing early
return, so this call happens before that check — same as the other hooks
already called unconditionally at the top of the component.)

- [ ] **Step 3: Swap the artwork square for `LyricsView` when toggled**

Replace:

```tsx
      <View style={styles.artwork} />
```

with:

```tsx
      {showLyrics ? (
        <LyricsView
          status={lyrics.status}
          plainLyrics={lyrics.plainLyrics}
          syncedLines={lyrics.syncedLines}
          positionSec={positionSec}
        />
      ) : (
        <View style={styles.artwork} />
      )}
```

- [ ] **Step 4: Add the toggle button**

Add it right after the `<QualityBadge quality={currentTrack.quality} />`
line:

```tsx
      <Pressable onPress={() => setShowLyrics((v) => !v)} style={styles.lyricsToggle}>
        <Text style={[typography.label, showLyrics && { color: colors.accent }]}>
          {showLyrics ? "ARTWORK" : "LYRICS"}
        </Text>
      </Pressable>
```

- [ ] **Step 5: Add the toggle button's style**

Add to the `StyleSheet.create` call, alongside the other style entries:

```typescript
  lyricsToggle: {
    marginTop: spacing.sm,
  },
```

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 7: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — no regressions.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/screens/NowPlayingScreen.tsx
git commit -m "feat(mobile): add a lyrics toggle to Now Playing"
```

---

### Task 8: Device verification handoff

**Files:** none (verification only)

- [ ] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The LRC parser and the LRCLIB client are fully
verified against hand-built fixtures and mocked HTTP responses.

- [ ] **Step 2: Give the user this checklist to confirm on device**

  - Open Now Playing for a track, tap "Lyrics": a loading state briefly
    appears, then either synced lyrics, plain lyrics, an instrumental
    message, or an unavailable message
  - For a track with synced lyrics: the active line highlights and the view
    auto-scrolls as the track plays, without any playback stutter or delay
  - Tapping "Lyrics" again returns to the artwork view
  - Reopening Now Playing for the same track later shows lyrics instantly
    (from cache), not another loading state
  - Playback continues uninterrupted the entire time lyrics are loading

- [ ] **Step 3: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation.

---

## Self-Review Notes

- **Spec coverage:** LRC parser with real edge cases (multi-timestamp lines,
  both separators, metadata-tag lines, minutes ≥ 60, sorting) ✓ (Task 1),
  LRCLIB client covering every failure mode plus the ±2s duration rounding
  and required header ✓ (Task 2), cache table (new table, no migration
  needed) ✓ (Task 4), cache-then-network hook decoupled from playback state ✓
  (Task 5), all four UI states plus synced auto-scroll ✓ (Task 6), toggle
  integration with no new screen/route ✓ (Task 7), honest verification split
  ✓ (Task 8). Batch/prefetch and publish/flag are explicitly out of scope per
  the design doc.
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `FetchLike` is reused from `../metadata/musicbrainz`
  (Phase 3a) rather than redefined — one shared shape for every `fetch`-
  injected client in `packages/shared`. `LyricsStatus` is defined once in
  `useLyrics.ts` (Task 5) and imported by `LyricsView` (Task 6) via
  `import type`. `CachedOrFetchedLyrics`'s shape in `useLyrics.ts` matches
  `LibraryDb.getCachedLyrics`'s return type and `LyricsMatch` from the LRCLIB
  client exactly, so `toState` accepts either without adapting.
- **No `@aura/types` changes needed:** lyrics data lives entirely in
  `LyricsState`/`LyricsMatch`, not on the `Track` type — matching how
  `packages/shared`'s FLAC and metadata modules keep their own concerns out
  of the app-wide domain types.
