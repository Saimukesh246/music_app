# AURA — Phase 1 Design: Mobile UI Shell (Mock Data)

Date: 2026-09-22
Status: Approved

## Purpose

AURA is a hi-res lossless music mobile app ("Your Music. Your Sound."). The full
product spans six phases (UI shell, local FLAC playback, metadata providers,
backend/auth, external music providers, recommendations/offline). This document
scopes **Phase 1 only**: a monorepo scaffold and a React Native/Expo app shell
with a premium dark UI, full navigation, and all primary screens driven by mock
data. No real audio decoding, no backend, no external API calls happen in this
phase — those are addressed in later phases and later specs.

## Non-goals for this phase

- No FLAC/audio file scanning or native audio modules
- No FastAPI backend, no database
- No calls to ReccoBeats, MusicBrainz, Cover Art Archive, or LRCLIB
- No authentication, no real persistence beyond lightweight local UI state
  (e.g. AsyncStorage for "last selected tab")
- No providers other than a single `MockProvider`

## Monorepo layout

pnpm workspaces:

```
aura/
├── apps/
│   ├── mobile/          Expo (dev client) + TypeScript app
│   └── api/              empty placeholder for Phase 4
├── packages/
│   ├── types/            shared TS types (Track, Album, Artist, Playlist, AudioQuality, ...)
│   └── shared/            MusicProvider interface + MockProvider + fixture data
├── docs/
├── pnpm-workspace.yaml
└── README.md
```

## Mobile app structure (`apps/mobile/src/`)

- `screens/` — Home, Search, Library, NowPlaying, Settings
- `components/` — mini-player, quality badge, artwork cards, track rows, etc.
- `navigation/` — bottom tabs + mini-player overlay + Now Playing modal
- `providers/` — wires `packages/shared`'s `MockProvider` into the app
- `store/` — Zustand slices: player, queue, library, favorites (mock-data backed;
  playback state simulated via timer, no real audio engine)
- `hooks/`, `utils/`, `theme/` — color tokens, spacing scale, type scale for the
  original (non-Spotify-clone) dark visual identity

## Provider abstraction

`packages/shared` defines the `MusicProvider` TypeScript interface:

```ts
interface MusicProvider {
  search(query: string): Promise<SearchResults>;
  getArtist(id: string): Promise<Artist>;
  getAlbum(id: string): Promise<Album>;
  getTrack(id: string): Promise<Track>;
  getPlaylist(id: string): Promise<Playlist>;
  getRecommendations(seed?: RecommendationSeed): Promise<Track[]>;
  getPlaybackSource(trackId: string): Promise<PlaybackSource>;
}
```

`MockProvider` implements this with realistic fixture data, including varied
audio-quality metadata (some tracks FLAC 24-bit/96kHz, some MP3 320kbps) so the
quality-badge component has real branching cases. No `TidalProvider` or other
provider stubs are created yet — those belong to Phase 3/5 and would be dead
code today.

## Navigation

React Navigation bottom tabs: Home / Search / Library / Settings. A persistent
mini-player renders above the tab bar across all tabs; tapping it opens the
full-screen Now Playing view as a modal. This matches the target UX of an
always-visible mini-player with tap-to-expand.

## Audio-quality display component

Built now against mock metadata, since the labeling logic (Lossless / Hi-Res
Lossless / Lossy / Unknown) is pure UI/branching logic independent of the real
decoder. The component's interface is designed so that in Phase 2, when the
real FLAC parser supplies actual bit-depth/sample-rate/bitrate, the component's
props don't need to change — only the data source does. No claim of
"bit-perfect" playback is made anywhere in this phase, since there is no real
audio pipeline yet to make that claim about.

## Testing

Jest + React Native Testing Library:
- Navigation smoke tests (tab switching, mini-player → Now Playing modal)
- Quality-badge unit tests covering Lossless / Hi-Res Lossless / Lossy / Unknown
  branches against representative mock tracks

## Tooling decisions

- Package manager: pnpm workspaces
- Mobile: Expo with dev client (keeps Expo DX, allows native modules later via
  config plugins for Phase 2's FLAC/Media3/AVFoundation work)
- Navigation: React Navigation
- State: Zustand
- Styling: React Native `StyleSheet` + a central theme/tokens module (no
  Tailwind/NativeWind dependency)

## Out of scope / future phases

Phase 2 (local FLAC scanning, real playback, queue persistence, playlists,
favorites against real data), Phase 3 (ReccoBeats, MusicBrainz, Cover Art
Archive, LRCLIB), Phase 4 (FastAPI backend, auth, cloud library), Phase 5
(authorized external providers, TIDAL via official APIs only), Phase 6
(recommendations, offline, performance, full test suite) are each their own
future spec.
