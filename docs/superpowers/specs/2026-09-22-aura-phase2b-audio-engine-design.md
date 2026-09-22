# AURA — Phase 2b Design: Real Audio Engine

Date: 2026-09-22
Status: Approved

## Purpose

Phase 2a made the library real. Phase 2b makes playback real: local files
selected from that library actually play, through a proper queue, with
lock-screen and notification controls, using `react-native-track-player`.

## Scope framing

**The public shape of `usePlayerStore` does not change.** `currentTrack`,
`queue`, `isPlaying`, `positionSec`, and the `playTrack`/`togglePlayPause`/
`playNext`/`playPrevious`/`seekTo`/`stop` actions stay exactly as they are.
Only the store's internals change — a `setInterval` fake ticker is replaced by
`react-native-track-player`'s real event emitter. This means **zero changes**
to `MiniPlayer`, `NowPlayingScreen`, or any other screen: the same payoff the
`LocalProvider` swap delivered in Phase 2a.

## Non-goals for this slice

- Audio focus loss / phone call interruption / headphone-disconnect handling
  (its own focused follow-up)
- Shuffle (needs a shuffled-queue algorithm; left for a later pass)
- Gapless playback tuning, crossfade, ReplayGain, playback speed
- Any change to the FLAC parser, SQLite schema, or `LocalProvider` from
  Phase 2a

## Components

### 1. Library setup

`react-native-track-player` v4 ships its own Expo config plugin, registered
in `app.json`'s `plugins` array. It handles the Android foreground service
registration and the `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`,
and `POST_NOTIFICATIONS` permissions.

A `PlaybackService.ts` registers remote-control event handlers — lock-screen
and notification play, pause, next, previous, and seek — as required by the
library's service-registration model.

### 2. Playback source

`LocalProvider.getPlaybackSource` (from Phase 2a) already returns the raw SAF
`content://` URI recovered from the track ID. ExoPlayer, which
`react-native-track-player` uses on Android, plays `content://` URIs directly.
No path translation is needed.

### 3. Queue

`playTrack(track, queue)` loads the full queue into the native player via
`TrackPlayer.setQueue()` followed by `TrackPlayer.skip()` to the selected
track. Next/previous become native player operations rather than JS array
math, which is also what keeps track transitions free of a JS-side reload.

### 4. Store rewrite

`usePlayerStore` subscribes to the player's events once, at store creation,
and mirrors them into the existing state shape:

- `PlaybackState` → `isPlaying`
- `PlaybackProgressUpdated` → `positionSec`
- `PlaybackActiveTrackChanged` → `currentTrack`

Every action (`togglePlayPause`, `playNext`, etc.) is a thin wrapper that
calls the corresponding `TrackPlayer.*` method. **State updates always flow
from the event, never optimistically** — so the UI cannot show "playing" when
the OS has actually paused playback for a phone call or another app.

### 5. Lock-screen / notification controls

Configured via `TrackPlayer.updateOptions()`, with a capability set — play,
pause, next, previous, seek — that matches the Now Playing screen's own
controls exactly, so there's no mismatch between what the lock screen offers
and what the in-app screen offers.

### 6. Repeat mode

`playerStore` gains a `repeatMode: "off" | "one" | "all"` field and a
`cycleRepeatMode()` action, mapped directly onto `TrackPlayer`'s native
`RepeatMode.Off` / `RepeatMode.Track` / `RepeatMode.Queue`. `NowPlayingScreen`
gets a repeat button reflecting and cycling this state. Shuffle is not
included.

## Testing

Verifiable by me, without a device:

- The store's event-mirroring logic, using a mocked `react-native-track-player`
  event emitter: a `PlaybackState` event updates `isPlaying`; a
  `PlaybackActiveTrackChanged` event updates `currentTrack`; a
  `PlaybackProgressUpdated` event updates `positionSec`
- The queue-loading logic: `playTrack` calls `setQueue` then `skip` with the
  right arguments
- `cycleRepeatMode` cycling off → all → one → off and calling
  `TrackPlayer.setRepeatMode` with the matching native constant
- Existing screen/component tests continue to pass against the same store
  shape

Requires the user's Android device (explicitly unverified by me):

- Actual sound output from a real file
- Lock-screen and notification controls actually appearing and working
- Background playback surviving the app being backgrounded
- Seeking, next/previous, and repeat behaving correctly against real audio

## Verification honesty

Claims about the store's event handling and queue logic will be backed by
test output using a mocked player. Claims about real playback, lock-screen
behavior, and background survival will not be made until the user confirms
them on device.
