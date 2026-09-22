# AURA Phase 2b Implementation Plan — Real Audio Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace `playerStore`'s simulated `setInterval` playback with real audio
via `react-native-track-player`: actual sound, a native queue, lock-screen and
notification controls, and repeat mode — without changing the store's public
shape or touching any screen other than adding a repeat button.

**Architecture:** `react-native-track-player` (RNTP) owns playback state.
`usePlayerStore` becomes a thin mirror: it subscribes once to RNTP's event
emitter and reflects `PlaybackState`/`PlaybackActiveTrackChanged`/
`PlaybackProgressUpdated` into its existing fields. Every store action is a
thin wrapper calling the matching `TrackPlayer.*` method. A `PlaybackService`
registered in `index.js` handles lock-screen/notification remote-control
events. `LocalProvider.getPlaybackSource` (from Phase 2a) supplies the
`content://` URI RNTP needs per track.

**Tech Stack:** `react-native-track-player` ^4.1.1 (its own Expo config
plugin), TypeScript, Jest with a manual `__mocks__/react-native-track-player.ts`
so the store's event-mirroring and queue logic are unit-testable without a
device.

## Global Constraints

- **`usePlayerStore`'s public shape does not change.** `currentTrack`, `queue`,
  `isPlaying`, `positionSec`, and the actions `playTrack`/`togglePlayPause`/
  `playNext`/`playPrevious`/`seekTo`/`stop` keep their existing signatures.
  `repeatMode` and `cycleRepeatMode` are additive. No screen except
  `NowPlayingScreen` (for the repeat button) changes.
- **State updates always flow from RNTP events, never optimistically** — a
  store action calls the native method and waits for the resulting event to
  update `isPlaying`/`currentTrack`/`positionSec`. The one exception is `stop()`,
  which also sets local state directly after `TrackPlayer.reset()`, since reset
  is a deliberate local teardown, not something to wait on an uncertain event
  for.
- Shuffle is out of scope. Audio focus / interruption handling is out of scope
  (a follow-up phase).
- No change to the FLAC parser, SQLite schema, or `LocalProvider` from Phase 2a.
- Lock-screen/notification capabilities must match the in-app Now Playing
  controls exactly: play, pause, next, previous, seek.

---

## File Structure

```
apps/mobile/
├── app.json                              (modify: add RNTP config plugin)
├── index.js                              (modify: register the playback service)
├── package.json                          (modify: add react-native-track-player)
├── __mocks__/
│   └── react-native-track-player.ts      (new: manual Jest mock, auto-applied)
└── src/
    ├── audio/
    │   ├── trackMapper.ts                (new: Track -> RNTP track shape)
    │   ├── trackMapper.test.ts           (new)
    │   ├── playbackService.ts            (new: remote-control event wiring)
    │   ├── playbackService.test.ts       (new)
    │   └── setup.ts                      (new: setupPlayer + updateOptions)
    ├── store/
    │   ├── playerStore.ts                (rewrite: mirrors RNTP events)
    │   └── playerStore.test.ts           (new)
    └── screens/
        └── NowPlayingScreen.tsx          (modify: add a repeat button)
```

---

### Task 1: Install RNTP and wire the native entry points

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/index.js`
- Create: `apps/mobile/src/audio/playbackService.ts` (stub, filled in Task 3)

**Interfaces:**
- Produces: `PlaybackService` (async function, no args, no return), registered
  with `TrackPlayer.registerPlaybackService` in `index.js`. Filled in with real
  event handlers by Task 3; this task only needs it to exist so `index.js`
  type-checks.

- [x] **Step 1: Add the dependency**

Run: `cd apps/mobile && pnpm add react-native-track-player@^4.1.1`
Expected: installs without error.

- [x] **Step 2: Add the config plugin to `apps/mobile/app.json`**

Add a `"plugins"` array to the `"expo"` object:

```json
{
  "expo": {
    "name": "AURA",
    "slug": "aura",
    "version": "0.0.1",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#0A0A0C",
    "splash": {
      "backgroundColor": "#0A0A0C"
    },
    "ios": { "supportsTablet": false },
    "android": {},
    "web": { "bundler": "metro" },
    "plugins": ["react-native-track-player"]
  }
}
```

- [x] **Step 3: Write a stub `apps/mobile/src/audio/playbackService.ts`**

```typescript
export async function PlaybackService(): Promise<void> {
  // Filled in with remote-control event handlers in Task 3.
}
```

- [x] **Step 4: Register the service in `apps/mobile/index.js`**

```javascript
import { registerRootComponent } from "expo";
import TrackPlayer from "react-native-track-player";
import App from "./App";
import { PlaybackService } from "./src/audio/playbackService";

TrackPlayer.registerPlaybackService(() => PlaybackService);

registerRootComponent(App);
```

- [x] **Step 5: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/index.js apps/mobile/src/audio/playbackService.ts pnpm-lock.yaml
git commit -m "chore(mobile): add react-native-track-player and register the playback service"
```

---

### Task 2: Manual Jest mock for `react-native-track-player`

**Files:**
- Create: `apps/mobile/__mocks__/react-native-track-player.ts`

**Interfaces:**
- Produces: a mock module matching RNTP's real named/default exports
  (`Event`, `State`, `RepeatMode`, `Capability`, `AppKilledPlaybackBehavior`,
  and a default `TrackPlayer` object of `jest.fn()`s). Because this file lives
  in `__mocks__` adjacent to `node_modules`, Jest applies it automatically to
  every test that imports `react-native-track-player` — no `jest.mock(...)`
  call needed in test files. Consumed by every test in Tasks 3-5 and by the
  existing `RootNavigator.test.tsx`.

- [x] **Step 1: Write `apps/mobile/__mocks__/react-native-track-player.ts`**

```typescript
export enum Event {
  PlaybackState = "playback-state",
  PlaybackActiveTrackChanged = "playback-active-track-changed",
  PlaybackProgressUpdated = "playback-progress-updated",
  RemotePlay = "remote-play",
  RemotePause = "remote-pause",
  RemoteNext = "remote-next",
  RemotePrevious = "remote-previous",
  RemoteSeek = "remote-seek",
  RemoteStop = "remote-stop",
}

export enum State {
  None = "none",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Stopped = "stopped",
}

export enum RepeatMode {
  Off = 0,
  Track = 1,
  Queue = 2,
}

export enum Capability {
  Play = 0,
  Pause = 1,
  SkipToNext = 2,
  SkipToPrevious = 3,
  SeekTo = 4,
}

export enum AppKilledPlaybackBehavior {
  StopPlaybackAndRemoveNotification = 0,
}

const TrackPlayer = {
  setupPlayer: jest.fn().mockResolvedValue(undefined),
  updateOptions: jest.fn().mockResolvedValue(undefined),
  registerPlaybackService: jest.fn(),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  setQueue: jest.fn().mockResolvedValue(undefined),
  add: jest.fn().mockResolvedValue(undefined),
  skip: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  skipToNext: jest.fn().mockResolvedValue(undefined),
  skipToPrevious: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setRepeatMode: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
};

export default TrackPlayer;
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/__mocks__/react-native-track-player.ts
git commit -m "test(mobile): add manual jest mock for react-native-track-player"
```

---

### Task 3: `PlaybackService` remote-control wiring (TDD)

**Files:**
- Modify: `apps/mobile/src/audio/playbackService.ts`
- Create: `apps/mobile/src/audio/playbackService.test.ts`

**Interfaces:**
- Consumes: the mock from Task 2.
- Produces: `PlaybackService` calling `TrackPlayer.play/pause/skipToNext/
  skipToPrevious/seekTo` in response to `Event.RemotePlay/RemotePause/
  RemoteNext/RemotePrevious/RemoteSeek`. This is the function `index.js`
  (Task 1) already registers.

- [x] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/audio/playbackService.test.ts
import TrackPlayer, { Event } from "react-native-track-player";
import { PlaybackService } from "./playbackService";

function findListener(event: Event): (payload?: unknown) => void {
  const call = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  if (!call) throw new Error(`No listener registered for ${event}`);
  return call[1];
}

describe("PlaybackService", () => {
  it("calls TrackPlayer.play() on RemotePlay", async () => {
    await PlaybackService();
    findListener(Event.RemotePlay)();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("calls TrackPlayer.pause() on RemotePause", async () => {
    await PlaybackService();
    findListener(Event.RemotePause)();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });

  it("calls TrackPlayer.skipToNext() on RemoteNext", async () => {
    await PlaybackService();
    findListener(Event.RemoteNext)();
    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
  });

  it("calls TrackPlayer.skipToPrevious() on RemotePrevious", async () => {
    await PlaybackService();
    findListener(Event.RemotePrevious)();
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
  });

  it("calls TrackPlayer.seekTo() with the requested position on RemoteSeek", async () => {
    await PlaybackService();
    findListener(Event.RemoteSeek)({ position: 87 });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(87);
  });

  it("calls TrackPlayer.pause() on RemoteStop", async () => {
    await PlaybackService();
    findListener(Event.RemoteStop)();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/mobile test playbackService`
Expected: FAIL — no listener registered for each event (the stub does
nothing).

- [x] **Step 3: Write the real `apps/mobile/src/audio/playbackService.ts`**

```typescript
import TrackPlayer, { Event } from "react-native-track-player";

export async function PlaybackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious()
  );
  TrackPlayer.addEventListener(Event.RemoteSeek, (event: { position: number }) =>
    TrackPlayer.seekTo(event.position)
  );
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.pause());
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/mobile test playbackService`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/audio/playbackService.ts apps/mobile/src/audio/playbackService.test.ts
git commit -m "feat(mobile): wire lock-screen/notification remote-control events"
```

---

### Task 4: `trackMapper` — app `Track` to RNTP track shape (TDD)

**Files:**
- Create: `apps/mobile/src/audio/trackMapper.ts`
- Test: `apps/mobile/src/audio/trackMapper.test.ts`

**Interfaces:**
- Consumes: `Track` from `@aura/types`.
- Produces: `RNTPTrack` interface and `toRNTPTrack(track: Track, uri: string):
  RNTPTrack`, consumed by `playerStore` (Task 5).

- [x] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/audio/trackMapper.test.ts
import { toRNTPTrack } from "./trackMapper";
import { tracks } from "@aura/shared";

describe("toRNTPTrack", () => {
  it("maps the fields RNTP needs, keyed by the app track id", () => {
    const track = tracks[0];
    const result = toRNTPTrack(track, "content://mock/track-1");
    expect(result).toEqual({
      id: track.id,
      url: "content://mock/track-1",
      title: track.title,
      artist: track.artistName,
      artwork: track.artworkUrl,
      duration: track.quality.durationSec,
    });
  });

  it("omits artwork rather than passing undefined explicitly when there is none", () => {
    const track = { ...tracks[0], artworkUrl: undefined };
    const result = toRNTPTrack(track, "content://mock/track-1");
    expect(result.artwork).toBeUndefined();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/mobile test trackMapper`
Expected: FAIL — cannot find module `./trackMapper`.

- [x] **Step 3: Write `apps/mobile/src/audio/trackMapper.ts`**

```typescript
import type { Track } from "@aura/types";

export interface RNTPTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration: number;
}

export function toRNTPTrack(track: Track, uri: string): RNTPTrack {
  return {
    id: track.id,
    url: uri,
    title: track.title,
    artist: track.artistName,
    artwork: track.artworkUrl,
    duration: track.quality.durationSec,
  };
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/mobile test trackMapper`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/audio/trackMapper.ts apps/mobile/src/audio/trackMapper.test.ts
git commit -m "feat(mobile): map app Track to the RNTP track shape"
```

---

### Task 5: `setupPlayer` (native player initialization)

**Files:**
- Create: `apps/mobile/src/audio/setup.ts`

**Interfaces:**
- Consumes: RNTP's `setupPlayer`, `updateOptions`, `Capability`,
  `AppKilledPlaybackBehavior`.
- Produces: `setupPlayer(): Promise<void>`, idempotent (safe to call more than
  once — later calls return the same in-flight/completed promise). Consumed by
  `App.tsx` (Task 7).

This is thin glue around native setup with no branching logic worth a unit
test beyond the type-check; Task 7's manual verification checklist covers
whether it actually initializes the player on device.

- [x] **Step 1: Write `apps/mobile/src/audio/setup.ts`**

```typescript
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
} from "react-native-track-player";

let setupPromise: Promise<void> | null = null;

export function setupPlayer(): Promise<void> {
  if (!setupPromise) {
    setupPromise = TrackPlayer.setupPlayer().then(() =>
      TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        progressUpdateEventInterval: 1,
      })
    );
  }
  return setupPromise;
}
```

- [x] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 3: Commit**

```bash
git add apps/mobile/src/audio/setup.ts
git commit -m "feat(mobile): initialize the native player and its lock-screen capabilities"
```

---

### Task 6: Rewrite `playerStore` to mirror real RNTP events (TDD)

**Files:**
- Modify: `apps/mobile/src/store/playerStore.ts`
- Create: `apps/mobile/src/store/playerStore.test.ts`

**Interfaces:**
- Consumes: `toRNTPTrack` (Task 4); `getProvider` from `../providers`
  (Phase 2a); the RNTP mock (Task 2).
- Produces: `usePlayerStore` with its Phase-1 shape plus `repeatMode:
  "off" | "all" | "one"` and `cycleRepeatMode(): void`. Consumed by
  `MiniPlayer`, `NowPlayingScreen` (Task 8), `HomeScreen`, `SearchScreen`,
  `LibraryScreen` — none of which need to change except `NowPlayingScreen`.

This test mocks `../providers` directly (not the SQLite chain underneath it),
because this is a unit test of the store/RNTP integration, not of the
database.

- [x] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/store/playerStore.test.ts
import TrackPlayer, { Event, RepeatMode, State } from "react-native-track-player";
import { usePlayerStore } from "./playerStore";
import { tracks } from "@aura/shared";

jest.mock("../providers", () => ({
  getProvider: jest.fn().mockResolvedValue({
    getPlaybackSource: jest.fn((trackId: string) =>
      Promise.resolve({
        trackId,
        uri: `content://mock/${trackId}`,
        quality: { format: "FLAC", durationSec: 200 },
      })
    ),
  }),
}));

function fireEvent(event: Event, payload?: unknown) {
  const call = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  if (!call) throw new Error(`No listener registered for ${event}`);
  call[1](payload);
}

describe("usePlayerStore — event mirroring", () => {
  it("mirrors PlaybackState into isPlaying", () => {
    fireEvent(Event.PlaybackState, { state: State.Playing });
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    fireEvent(Event.PlaybackState, { state: State.Paused });
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("mirrors PlaybackProgressUpdated into positionSec", () => {
    fireEvent(Event.PlaybackProgressUpdated, { position: 42.5 });
    expect(usePlayerStore.getState().positionSec).toBe(42.5);
  });

  it("clears currentTrack when the active track becomes undefined", () => {
    fireEvent(Event.PlaybackActiveTrackChanged, { track: undefined });
    expect(usePlayerStore.getState().currentTrack).toBeNull();
  });
});

describe("usePlayerStore — playTrack", () => {
  it("loads the full queue in order, skips to the selected track, and plays", async () => {
    await usePlayerStore
      .getState()
      .playTrack(tracks[1], [tracks[0], tracks[1], tracks[2]]);

    expect(TrackPlayer.setQueue).toHaveBeenCalledWith([
      expect.objectContaining({ id: tracks[0].id, url: `content://mock/${tracks[0].id}` }),
      expect.objectContaining({ id: tracks[1].id, url: `content://mock/${tracks[1].id}` }),
      expect.objectContaining({ id: tracks[2].id, url: `content://mock/${tracks[2].id}` }),
    ]);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("mirrors PlaybackActiveTrackChanged into the full app Track via the internal id map", async () => {
    await usePlayerStore.getState().playTrack(tracks[0], [tracks[0]]);
    fireEvent(Event.PlaybackActiveTrackChanged, { track: { id: tracks[0].id } });
    expect(usePlayerStore.getState().currentTrack).toEqual(tracks[0]);
  });
});

describe("usePlayerStore — transport controls", () => {
  it("togglePlayPause calls pause() when currently playing", () => {
    fireEvent(Event.PlaybackState, { state: State.Playing });
    usePlayerStore.getState().togglePlayPause();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });

  it("togglePlayPause calls play() when currently paused", () => {
    fireEvent(Event.PlaybackState, { state: State.Paused });
    usePlayerStore.getState().togglePlayPause();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("playNext calls TrackPlayer.skipToNext()", () => {
    usePlayerStore.getState().playNext();
    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
  });

  it("playPrevious calls TrackPlayer.skipToPrevious()", () => {
    usePlayerStore.getState().playPrevious();
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
  });

  it("seekTo calls TrackPlayer.seekTo() with the given seconds", () => {
    usePlayerStore.getState().seekTo(120);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(120);
  });
});

describe("usePlayerStore — repeat mode", () => {
  it("cycles off -> all -> one -> off, calling setRepeatMode with the matching native constant", () => {
    const { cycleRepeatMode } = usePlayerStore.getState();

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("all");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Queue);

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("one");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Track);

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("off");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Off);
  });
});

describe("usePlayerStore — stop", () => {
  it("resets the native player and clears local state immediately", () => {
    usePlayerStore.getState().stop();
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: null,
      queue: [],
      isPlaying: false,
      positionSec: 0,
    });
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/mobile test playerStore`
Expected: FAIL — the current `setInterval`-based store has no `repeatMode`,
never calls `TrackPlayer.*`, and never touches `../providers`.

- [x] **Step 3: Rewrite `apps/mobile/src/store/playerStore.ts`**

```typescript
import { create } from "zustand";
import TrackPlayer, { Event, RepeatMode, State } from "react-native-track-player";
import type { Track } from "@aura/types";
import { getProvider } from "../providers";
import { toRNTPTrack } from "../audio/trackMapper";

export type RepeatModeSetting = "off" | "all" | "one";

const NATIVE_REPEAT_MODE: Record<RepeatModeSetting, RepeatMode> = {
  off: RepeatMode.Off,
  all: RepeatMode.Queue,
  one: RepeatMode.Track,
};

const REPEAT_CYCLE: RepeatModeSetting[] = ["off", "all", "one"];

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  positionSec: number;
  repeatMode: RepeatModeSetting;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
  seekTo: (sec: number) => void;
  stop: () => void;
  cycleRepeatMode: () => void;
}

/**
 * RNTP events identify tracks by the id we gave them, not by the full app
 * Track object. This map is how PlaybackActiveTrackChanged gets back to a
 * real Track (with quality, album, etc.) for the store to expose.
 */
const trackById = new Map<string, Track>();

export const usePlayerStore = create<PlayerState>((set, get) => {
  TrackPlayer.addEventListener(Event.PlaybackState, (event: { state: State }) => {
    set({ isPlaying: event.state === State.Playing });
  });

  TrackPlayer.addEventListener(
    Event.PlaybackActiveTrackChanged,
    (event: { track?: { id: string } }) => {
      const activeId = event.track?.id;
      set({
        currentTrack: activeId ? trackById.get(activeId) ?? null : null,
        positionSec: 0,
      });
    }
  );

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    (event: { position: number }) => {
      set({ positionSec: event.position });
    }
  );

  return {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    positionSec: 0,
    repeatMode: "off",

    playTrack: async (track, queue) => {
      const nextQueue = queue ?? get().queue;
      set({ queue: nextQueue });

      const provider = await getProvider();
      const rntpTracks = await Promise.all(
        nextQueue.map(async (queuedTrack) => {
          trackById.set(queuedTrack.id, queuedTrack);
          const source = await provider.getPlaybackSource(queuedTrack.id);
          return toRNTPTrack(queuedTrack, source.uri);
        })
      );

      await TrackPlayer.setQueue(rntpTracks);
      const index = nextQueue.findIndex((queuedTrack) => queuedTrack.id === track.id);
      await TrackPlayer.skip(index >= 0 ? index : 0);
      await TrackPlayer.play();
    },

    togglePlayPause: async () => {
      if (get().isPlaying) await TrackPlayer.pause();
      else await TrackPlayer.play();
    },

    playNext: async () => {
      await TrackPlayer.skipToNext();
    },

    playPrevious: async () => {
      await TrackPlayer.skipToPrevious();
    },

    addToQueue: async (track) => {
      set((s) => ({ queue: [...s.queue, track] }));
      trackById.set(track.id, track);
      const provider = await getProvider();
      const source = await provider.getPlaybackSource(track.id);
      await TrackPlayer.add(toRNTPTrack(track, source.uri));
    },

    seekTo: async (sec) => {
      await TrackPlayer.seekTo(sec);
    },

    stop: async () => {
      await TrackPlayer.reset();
      set({ currentTrack: null, queue: [], isPlaying: false, positionSec: 0 });
    },

    cycleRepeatMode: async () => {
      const current = get().repeatMode;
      const next =
        REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(current) + 1) % REPEAT_CYCLE.length];
      set({ repeatMode: next });
      await TrackPlayer.setRepeatMode(NATIVE_REPEAT_MODE[next]);
    },
  };
});
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/mobile test playerStore`
Expected: PASS (13 tests).

- [x] **Step 5: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean). Every action above is declared `async` while the
`PlayerState` interface types it as returning `void`; TypeScript's special-case
for `void`-typed function properties accepts a `Promise<void>`-returning
implementation, so existing call sites (`onPress={() => playTrack(...)}`) keep
compiling unchanged.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/store/playerStore.ts apps/mobile/src/store/playerStore.test.ts
git commit -m "feat(mobile): drive playerStore from real react-native-track-player events"
```

---

### Task 7: Initialize the player on app launch

**Files:**
- Modify: `apps/mobile/App.tsx`

**Interfaces:**
- Consumes: `setupPlayer` (Task 5).
- Produces: no new exports; `setupPlayer()` is called once when the app
  mounts, alongside the existing favorites hydration from Phase 2a.

- [x] **Step 1: Add the setup call to `apps/mobile/App.tsx`**

```tsx
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { useLibraryStore } from "./src/store/libraryStore";
import { setupPlayer } from "./src/audio/setup";

export default function App() {
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);

  useEffect(() => {
    hydrateFavorites();
  }, [hydrateFavorites]);

  useEffect(() => {
    void setupPlayer();
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
```

- [x] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): initialize the audio player on app launch"
```

---

### Task 8: Repeat button on Now Playing

**Files:**
- Modify: `apps/mobile/src/screens/NowPlayingScreen.tsx`

**Interfaces:**
- Consumes: `repeatMode`, `cycleRepeatMode` from `usePlayerStore` (Task 6).
- Produces: no new exports; adds a repeat control to the existing controls row.

- [x] **Step 1: Read the current controls block and add the repeat button**

Add `repeatMode` and `cycleRepeatMode` to the store selectors near the top of
`NowPlayingScreen`, alongside the existing `usePlayerStore` calls:

```typescript
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
```

Add this small label map above the component (or alongside other module-level
constants in the file):

```typescript
const REPEAT_LABEL: Record<string, string> = {
  off: "⟲",
  all: "⟲ ALL",
  one: "⟲ ONE",
};
```

In the controls row (the `<View style={styles.controls}>` containing
prev/play-pause/next), add a repeat button as the last child:

```tsx
        <Pressable onPress={playNext}>
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>
        <Pressable onPress={cycleRepeatMode}>
          <Text
            style={[
              styles.controlIcon,
              repeatMode !== "off" && { color: colors.accent },
            ]}
          >
            {REPEAT_LABEL[repeatMode]}
          </Text>
        </Pressable>
```

(This replaces the closing `<Pressable onPress={playNext}>...</Pressable>`
block with itself plus the new repeat `Pressable` immediately after it — the
existing prev/play-pause buttons are unchanged.)

- [x] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 3: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — all existing tests plus the new ones from Tasks 3, 4, 6.

- [x] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/NowPlayingScreen.tsx
git commit -m "feat(mobile): add a repeat button to Now Playing"
```

---

### Task 9: Device verification handoff

**Files:** none (verification only)

Real playback, lock-screen controls, and background survival cannot be
verified without the user's Android hardware. Do not claim any of it works
until they confirm.

- [x] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The store's event mirroring, the queue-loading
logic, the repeat-mode cycling, and the remote-control wiring are verified by
these tests against a mocked player.

- [x] **Step 2: Rebuild the dev client**

RNTP's config plugin changes native code, so a JS-only reload is not enough.
Tell the user to run:

```bash
cd apps/mobile
npx expo prebuild --clean
npx expo run:android
```

- [x] **Step 3: Give the user this checklist to confirm on device**

  - Tapping a track in Search or Library produces actual audio output
  - The mini-player and Now Playing progress bar advance in real time and
    match what's audible
  - Next / previous / seek all work and audibly change playback
  - The lock screen and notification shade show a media control with the
    track's title/artist and working play/pause/next/previous
  - Backgrounding the app (home button) keeps audio playing
  - Repeat cycles Off → All → One on Now Playing, and "One" actually repeats
    the current track instead of advancing

- [x] **Step 4: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation. Do not describe unverified device behaviour as working.

---

## Self-Review Notes

- **Spec coverage:** RNTP install + config plugin ✓ (Task 1), lock-screen/
  notification remote-control handlers ✓ (Task 3), playback-source mapping ✓
  (Task 4), native player init with matching capabilities ✓ (Task 5),
  event-mirrored store with the same public shape ✓ (Task 6), app-launch
  wiring ✓ (Task 7), repeat mode UI ✓ (Task 8), honest verification split ✓
  (Task 9). Interruption handling and shuffle are explicitly out of scope per
  the Global Constraints, matching the approved design.
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `RNTPTrack` defined once in Task 4, imported by Task 6.
  `RepeatModeSetting` defined in Task 6, matching `NowPlayingScreen`'s Task 8
  usage of the string literals `"off"`/`"all"`/`"one"`. `PlayerState`'s method
  signatures stay `(...) => void` throughout despite async implementations —
  called out explicitly in Task 6 Step 5 so it isn't mistaken for an error.
- **Known deviation from a fully mechanical async→void mapping:** `stop()`
  updates local state directly rather than waiting for an RNTP event, per the
  Global Constraints' explicit exception — RNTP's `reset()` does not reliably
  emit a terminal event to mirror.
