# AURA — Interruption Handling Design

Date: 2026-09-22
Status: Approved

## Purpose

Phase 2b deferred audio focus loss (phone calls, other apps), headphone/
Bluetooth disconnect, and alarm ducking. This closes that gap: AURA must
behave correctly when something else needs the speaker.

## Grounding in the actual native source

Rather than assume `react-native-track-player`'s interruption behavior (the
mistake made in Phase 2b with the nonexistent config plugin), this design was
checked directly against the installed package's native Android source
(`MusicService.kt`) and TypeScript interfaces:

- `event.onAudioFocusChanged` always emits `Event.RemoteDuck` with
  `{ paused: boolean, permanent: boolean }` on any audio focus change,
  regardless of configuration.
- `android.alwaysPauseOnInterruption` (an `updateOptions()` field) makes the
  native layer fully pause on **every** interruption, transient or permanent,
  rather than ducking (reducing volume) for transient ones. Default is
  ducking; we do not want ducking.
- `RemoteDuckEvent`'s own doc comment says resuming is advisory only: "when
  false the player **may** resume playback." The native layer does not
  auto-resume — that decision belongs to the app.
- Headphone/Bluetooth disconnect is handled by a **separate**, unconditional
  native mechanism (`handleAudioBecomingNoisy = true`, always set) that calls
  a plain pause — it does not go through `RemoteDuck` at all, so it cannot
  accidentally trigger the resume logic below.

## The rule

**Pause outright on any interruption; auto-resume only after a transient
interruption ends, and only if nothing else touched playback in the
meantime.**

- Transient loss (`paused: true, permanent: false`) — a notification sound, a
  brief nav-app ping: native already paused (because
  `alwaysPauseOnInterruption: true`). The store remembers this was an
  interruption-caused pause.
- Permanent loss (`paused: true, permanent: true`) — another app started
  playing: native already paused. The store does **not** mark this as
  resumable; the user decides when to press play again.
- Focus regained (`paused: false`): if the store still has an
  interruption-caused pause on record, resume; otherwise do nothing.
- **Any explicit user/UI action clears the resumable flag** — starting a new
  track, toggling play/pause, skipping, or stopping. If the user acted while
  audio was ducked out, AURA must never later override that by resuming on
  its own.
- Headphone/Bluetooth disconnect needs no new code: it is already native,
  always on, routes through a plain pause that never touches this flag, so it
  can never trigger an auto-resume.

## Non-goals

- Alarm ducking beyond what `alwaysPauseOnInterruption` already provides —
  an alarm triggers the same `RemoteDuck` mechanism as any other transient
  interruption; no special-cased handling is needed or added.
- iOS-specific tuning. The same `RemoteDuck` event exists on iOS per its own
  doc comment, so the same store logic applies, but this pass is verified on
  Android only, matching every prior phase.
- Any change to the queue, repeat mode, or lock-screen controls from Phase 2b.

## Testing

Verifiable by me, without a device (same mocked-event pattern used for
`PlaybackState`/`PlaybackActiveTrackChanged` in Phase 2b):

- A transient `RemoteDuck` followed by focus regained resumes playback
- A permanent `RemoteDuck` followed by focus regained does **not** resume
- A transient `RemoteDuck`, then a user action (`togglePlayPause`, `playTrack`,
  `playNext`, `playPrevious`, or `stop`), then focus regained does **not**
  resume — the user's action took precedence
- `setup.ts` passes `alwaysPauseOnInterruption: true` in its `updateOptions`
  call

Requires the user's Android device (explicitly unverified by me):

- A real phone call or notification actually produces this event sequence
- Headphone/Bluetooth unplug pauses playback and does not resume on its own
- The overall feel is correct — no audible ducking, clean pause and resume
