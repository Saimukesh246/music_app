# AURA — Phase 2a Design: Local Library Data Layer

Date: 2026-09-22
Status: Approved

## Purpose

Phase 1 delivered a navigable UI shell backed by fixture data. Phase 2a makes
that UI **real**: it imports actual audio files from the device, parses genuine
FLAC metadata from the file bytes, persists a library in SQLite, and serves it
to the existing screens through the `MusicProvider` interface.

The defining constraint of this slice is honesty about audio quality. Phase 1
could display "Hi-Res Lossless" because a fixture said so. From here on, that
label must be earned from bytes actually read off disk.

## Scope framing

**This slice makes the Phase 1 UI real without adding new screens.** Home,
Search, Library, Now Playing and Settings stay as they are; only the data
behind them changes, plus the one new entry point needed to pick a music
folder.

## Non-goals for this slice

- No real audio playback and no `react-native-track-player` (next slice)
- No background playback, lock-screen, or headset controls (next slice)
- No embedded artwork (PICTURE block) extraction or artwork cache
- No playlist CRUD UI (schema lands here, UI rides with the audio slice)
- No parsers for MP3/AAC/ALAC/WAV internals (extension-level handling only)
- No cloud/backend anything

## The integrity rule

This is the product principle from the original brief, stated as an
implementable rule:

> **Quality may be downgraded on weak evidence, never upgraded.**

Concretely:

- `Lossless` and `Hi-Res Lossless` may ONLY be assigned from values read out of
  a valid `STREAMINFO` block. No other evidence is sufficient.
- A file named `.flac` whose magic bytes are not `fLaC`, or whose STREAMINFO is
  missing or truncated, is labeled `Unknown`. It is never assumed lossless.
- A file with a lossy extension (`.mp3`, `.aac`, `.m4a`) may be labeled `Lossy`
  from the extension alone, because that claim is conservative — it cannot
  oversell quality.
- Nothing anywhere claims "bit-perfect". There is still no real audio pipeline
  to make such a claim about.

The adversarial case (a mislabeled `.flac`) is a required test case, not an
edge case.

## Components

### 1. FLAC parser — `packages/shared/src/flac/`

Pure TypeScript, zero dependencies, operating on a `Uint8Array`:

```ts
parseFlacMetadata(bytes: Uint8Array): FlacMetadata | null
```

Returns `null` when the input is not a parseable FLAC stream. Otherwise:

- Verifies the 4-byte `fLaC` magic (`0x66 0x4C 0x61 0x43`)
- Walks the metadata block chain; each block header is 1 byte (last-block flag
  + 7-bit type) followed by a 3-byte big-endian length
- `STREAMINFO` (type 0) is bit-packed: sample rate (20 bits), channels (3 bits,
  stored as n-1), bits per sample (5 bits, stored as n-1), total samples
  (36 bits). Duration is total samples / sample rate.
- `VORBIS_COMMENT` (type 4) is little-endian: vendor string length + string,
  then a comment count and `KEY=value` entries. We read `TITLE`, `ARTIST`,
  `ALBUM`, `ALBUMARTIST`, `TRACKNUMBER`, `DATE` (case-insensitive keys).

Being a pure function over bytes, it is exhaustively unit-testable in Node with
hand-constructed fixtures and needs no device.

### 2. Folder scan — `apps/mobile/src/library/`

Uses `expo-file-system`'s Storage Access Framework on Android: the user grants
access to a directory, and we enumerate its entries.

**Only the first 64KB of each file is read** for header parsing. Whole audio
files are never loaded into memory — an explicit performance requirement from
the original brief and a practical necessity for libraries of hundreds of
tracks.

Per the approved handling of unparseable files: everything found is imported,
labeled honestly. Nothing is silently dropped.

### 3. Persistence — `expo-sqlite`

Tables created on first launch: `artists`, `albums`, `tracks`, `favorites`,
`playlists`, `playlist_tracks`. Artists and albums are derived from parsed tags
and de-duplicated on insert (by name, and by title + artist respectively).
Tracks store the parsed quality fields and the file URI.

`playlists`/`playlist_tracks` are created now so the schema is stable, but no
playlist CRUD ships in this slice.

### 4. `LocalProvider`

Implements the existing `MusicProvider` interface against SQLite. The screens
are unchanged — they are simply handed a different provider. This is the payoff
of the Phase 1 abstraction and the main proof it was worth building.

Favorites move from in-memory Zustand to SQLite so they survive an app restart.

## Testing

Verifiable by me, without a device:

- Parser: valid 24-bit/96kHz, valid 16-bit/44.1kHz, mislabeled `.flac` with bad
  magic (must yield `Unknown`, never lossless), truncated STREAMINFO, missing
  VORBIS_COMMENT, unusual sample rates, multi-block chains
- Quality labeling against parser output, including the downgrade-never-upgrade
  rule
- SQLite layer: schema creation, de-duplication of artists/albums, favorites
  round-trip, `LocalProvider` satisfying the `MusicProvider` contract

Requires the user's Android device (explicitly unverified by me):

- The SAF directory picker and permission grant
- Real file I/O and end-to-end scanning of an actual music folder
- Performance against a large real library

## Verification honesty

Claims about the parser, labeling, and database layer will be backed by test
output. Claims about folder picking and real file I/O will not be made until
the user confirms them on device; those will be reported as untested.
