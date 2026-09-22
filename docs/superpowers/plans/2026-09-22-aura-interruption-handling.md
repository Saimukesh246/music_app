# AURA Interruption Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make AURA pause outright (never duck) on any audio interruption and
resume automatically only after a transient interruption ends with nothing
else having touched playback meanwhile — closing the gap Phase 2b deferred.

**Architecture:** One config flag (`alwaysPauseOnInterruption`) makes RNTP's
native layer fully pause instead of ducking. `playerStore` gains a private
`pausedByInterruption` flag and a `RemoteDuck` event handler implementing the
resume rule; every explicit user/UI action already in the store clears the
flag. Headphone/Bluetooth disconnect needs no code — it's already native,
unconditional, and routes through plain pause, never `RemoteDuck`.

**Tech Stack:** TypeScript, the existing `__mocks__/react-native-track-player.ts`
manual Jest mock (gains the `RemoteDuck` event), Jest.

## Global Constraints

- Pause outright on every interruption, transient or permanent — no ducking.
- Auto-resume only after a transient interruption ends (`RemoteDuck` with
  `permanent: false`, then a later `RemoteDuck` with `paused: false`), and
  only if no explicit user/UI action happened in between.
- Permanent focus loss and headphone/Bluetooth disconnect are never eligible
  for auto-resume.
- No change to the queue, repeat mode, lock-screen controls, or any screen
  from Phase 2b. `PlayerState`'s public shape is unchanged; the interruption
  flag is private to the store module, not exposed.

---

## File Structure

```
apps/mobile/
├── __mocks__/
│   └── react-native-track-player.ts   (modify: add Event.RemoteDuck)
└── src/
    ├── audio/
    │   └── setup.ts                    (modify: alwaysPauseOnInterruption)
    └── store/
        ├── playerStore.ts              (modify: RemoteDuck handling)
        └── playerStore.test.ts         (modify: add interruption tests)
```

---

### Task 1: Configure native pause-not-duck behavior

**Files:**
- Modify: `apps/mobile/src/audio/setup.ts`

**Interfaces:**
- No signature changes; `setupPlayer()` still returns `Promise<void>`.

- [x] **Step 1: Add `alwaysPauseOnInterruption` to the `updateOptions` call**

In `apps/mobile/src/audio/setup.ts`, add `alwaysPauseOnInterruption: true` to
the existing `android` object passed to `TrackPlayer.updateOptions`:

```typescript
      TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          alwaysPauseOnInterruption: true,
        },
```

(The rest of the `updateOptions` call — `capabilities`, `compactCapabilities`,
`progressUpdateEventInterval` — is unchanged.)

- [x] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 3: Commit**

```bash
git add apps/mobile/src/audio/setup.ts
git commit -m "feat(mobile): pause outright rather than duck on audio interruptions"
```

---

### Task 2: Add `RemoteDuck` to the manual RNTP mock

**Files:**
- Modify: `apps/mobile/__mocks__/react-native-track-player.ts`

**Interfaces:**
- Produces: `Event.RemoteDuck` on the mock's `Event` enum, consumed by
  Task 3's tests.

- [x] **Step 1: Add the event to the mock's `Event` enum**

In `apps/mobile/__mocks__/react-native-track-player.ts`, add `RemoteDuck` next
to the other events:

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
  RemoteDuck = "remote-duck",
}
```

- [x] **Step 2: Commit**

```bash
git add apps/mobile/__mocks__/react-native-track-player.ts
git commit -m "test(mobile): add RemoteDuck to the RNTP jest mock"
```

---

### Task 3: `playerStore` interruption handling (TDD)

**Files:**
- Modify: `apps/mobile/src/store/playerStore.ts`
- Modify: `apps/mobile/src/store/playerStore.test.ts`

**Interfaces:**
- Consumes: `Event.RemoteDuck` (Task 2).
- Produces: no new exports on `PlayerState` — the resume logic is internal.
  `playTrack`, `togglePlayPause`, `playNext`, `playPrevious`, and `stop` gain
  the side effect of clearing the private interruption flag; their existing
  signatures and behavior are otherwise unchanged.

- [x] **Step 1: Write the failing tests**

Append this to `apps/mobile/src/store/playerStore.test.ts`:

```typescript
describe("usePlayerStore — interruption handling", () => {
  it("resumes after a transient interruption ends", () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("does not resume after a permanent interruption ends", () => {
    (TrackPlayer.play as jest.Mock).mockClear();

    fireEvent(Event.RemoteDuck, { paused: true, permanent: true });
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if togglePlayPause ran during the interruption", () => {
    (TrackPlayer.play as jest.Mock).mockClear();

    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    usePlayerStore.getState().togglePlayPause();
    (TrackPlayer.play as jest.Mock).mockClear(); // clear the call toggle itself made
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if stop() ran during the interruption", async () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    await usePlayerStore.getState().stop();
    (TrackPlayer.play as jest.Mock).mockClear();
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if playNext ran during the interruption", () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    usePlayerStore.getState().playNext();
    (TrackPlayer.play as jest.Mock).mockClear();
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/mobile test playerStore`
Expected: FAIL — the current store has no `RemoteDuck` listener, so `play()`
is never called by any of these tests.

- [x] **Step 3: Add the interruption flag and handler to `playerStore.ts`**

Add this inside the `create<PlayerState>((set, get) => { ... })` factory,
right after the existing `TrackPlayer.addEventListener` calls (after the
`PlaybackProgressUpdated` listener, before the `return { ... }`):

```typescript
  // True only while a transient interruption (RemoteDuck with
  // permanent: false) is in effect and nothing else has touched playback
  // since. Cleared by every explicit user/UI action below.
  let pausedByInterruption = false;

  TrackPlayer.addEventListener(
    Event.RemoteDuck,
    (event: { paused: boolean; permanent: boolean }) => {
      if (event.paused) {
        pausedByInterruption = !event.permanent;
      } else if (pausedByInterruption) {
        pausedByInterruption = false;
        void TrackPlayer.play();
      }
    }
  );
```

Then clear the flag at the start of each of these existing actions (add
`pausedByInterruption = false;` as the first line of each function body):

```typescript
    playTrack: async (track, queue) => {
      pausedByInterruption = false;
      const nextQueue = queue ?? get().queue;
      // ...unchanged...
```

```typescript
    togglePlayPause: async () => {
      pausedByInterruption = false;
      if (get().isPlaying) await TrackPlayer.pause();
      else await TrackPlayer.play();
    },
```

```typescript
    playNext: async () => {
      pausedByInterruption = false;
      await TrackPlayer.skipToNext();
    },
```

```typescript
    playPrevious: async () => {
      pausedByInterruption = false;
      await TrackPlayer.skipToPrevious();
    },
```

```typescript
    stop: async () => {
      pausedByInterruption = false;
      await TrackPlayer.reset();
      set({ currentTrack: null, queue: [], isPlaying: false, positionSec: 0 });
    },
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/mobile test playerStore`
Expected: PASS (17 tests — the 12 from Phase 2b plus 5 new).

- [x] **Step 5: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [x] **Step 6: Run the full mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — every suite green, no regressions from the interleaved test
ordering (the store is a singleton across the file, so later `describe`
blocks can observe state earlier ones left behind; the tests above each
explicitly set up the sequence they need rather than assuming a clean slate).

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/store/playerStore.ts apps/mobile/src/store/playerStore.test.ts
git commit -m "feat(mobile): auto-resume only after a transient interruption with no intervening user action"
```

---

### Task 4: Device verification handoff

**Files:** none (verification only)

- [x] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The interruption flag's state machine — transient
resume, permanent no-resume, and every user-action override — is verified
against a mocked player.

- [x] **Step 2: Give the user this checklist to confirm on device**

  - Playing music, then receiving a notification with sound: playback pauses
    cleanly (no ducking/volume drop heard) and resumes on its own once the
    notification sound ends
  - Playing music, then opening another app that plays audio: AURA pauses
    and does **not** resume when the other app stops
  - Playing music, then pulling out wired headphones or disconnecting
    Bluetooth: playback pauses and does not resume on reconnect
  - Playing music, receiving a notification, and tapping pause on AURA's own
    lock-screen control before the notification sound ends: AURA stays
    paused once the notification ends (does not auto-resume over the user's
    choice)

- [x] **Step 3: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation.

---

## Self-Review Notes

- **Spec coverage:** pause-not-duck config ✓ (Task 1), transient resume ✓,
  permanent no-resume ✓, every explicit user action overriding resume ✓
  (Task 3), headphone/Bluetooth disconnect requiring no code — explicitly
  noted as already handled natively, not silently dropped ✓ (design doc +
  Task 4 checklist), honest verification split ✓ (Task 4).
- **Placeholder scan:** no TBD/TODO; every step has literal code.
- **Type consistency:** `pausedByInterruption` is a plain `let` closed over by
  the store factory, not part of `PlayerState` — matches the Global
  Constraints' "not exposed" requirement. The `RemoteDuck` event payload type
  `{ paused: boolean; permanent: boolean }` matches RNTP's own
  `RemoteDuckEvent` interface exactly (verified against the installed
  package's `.d.ts` during design).
- **Test ordering note:** Task 3 Step 3's tests each explicitly fire the
  `RemoteDuck` sequence they need rather than relying on the flag's state
  from a previous test, since the store is a module-level singleton shared
  across the whole test file (consistent with the existing tests in this
  file from Phase 2b).
