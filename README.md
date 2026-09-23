# AURA — Your Music. Your Sound.

A production-quality, audiophile-focused mobile music application and cloud platform built for bit-perfect Hi-Res Lossless audio streaming, offline playback, local library curation, and cloud synchronization.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────┐
                        │              AURA Mobile                │
                        │    (React Native / Expo / TypeScript)   │
                        └──────────────────┬──────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│  Local Provider  │             │ Internet Archive │             │    Aura Cloud    │
│  (Device Storage │             │   (Free & Open   │             │ (FastAPI Backend │
│  + SQLite Cache) │             │    Recordings)   │             │   + Supabase DB) │
└──────────────────┘             └──────────────────┘             └────────┬─────────┘
                                                                           │
                                                                           ▼
                                                                  ┌──────────────────┐
                                                                  │ Supabase Postgres│
                                                                  │ (Cloud Catalog & │
                                                                  │   User Library)  │
                                                                  └──────────────────┘
```

### Monorepo Structure

- **`apps/mobile`**: Mobile application built with Expo, React Native Track Player, Zustand, and TypeScript.
- **`apps/api`**: Cloud backend API built with FastAPI, PyJWT, psycopg 3, and Supabase PostgreSQL.
- **`packages/shared`**: Cross-platform utilities, metadata parsers (FLAC/ID3), synced lyrics (.lrc) parser, acoustic recommendations engine, and `MusicProvider` implementations (`LocalProvider`, `InternetArchiveProvider`, `AuraCloudProvider`).
- **`packages/types`**: Shared TypeScript types for tracks, albums, artists, playlists, audio quality parameters, and provider interfaces.

---

## All Completed Phases

1. **Phase 1 — Player Core & UI Shell**:
   - Audio playback engine via `react-native-track-player`.
   - Dark audiophile theme design tokens, MiniPlayer, and NowPlaying bottom sheet.
2. **Phase 2a — Local Library Storage**:
   - Local music scanner via `expo-file-system`.
   - Relational database schema on `expo-sqlite` with full index coverage.
3. **Phase 2b — Audio Engine & Lossless Playback**:
   - Bit-perfect playback support for FLAC, ALAC, WAV, and AIFF.
   - Gapless playback, zero-latency pre-buffering, and audio quality tags.
4. **Phase 3a — Metadata & Artwork Enrichment**:
   - Automated MusicBrainz release matching and CoverArtArchive cover fetching.
   - Client-side rate-limited API throttling.
5. **Phase 3b — Synced & Plain Lyrics**:
   - `.lrc` timestamp-synchronized lyrics parser with auto-scroll and line highlighting.
   - Online lyrics fetching via `lrclib.net` integration.
6. **Phase 3c — Acoustic Recommendations**:
   - ReccoBeats acoustic feature extraction (energy, acousticness, tempo).
   - Seed-based acoustic vector similarity engine.
7. **Phase 4 — FastAPI Cloud Backend**:
   - JWT user registration & authentication.
   - HTTP byte-range audio streaming engine with 206 Partial Content support.
   - Cloud catalog, favorites, and play history tracking.
8. **Phase 5 — Pluggable Music Providers**:
   - `MusicProvider` contract abstraction.
   - Pluggable `LocalProvider` and `InternetArchiveProvider`.
9. **Phase 6 — Audio Polish & System Interruptions**:
   - Audio focus handling (phone calls, navigation prompts, ducking).
   - Headset unplug auto-pause (`RemoteDuck`).
10. **Phase 7 — Playlists & Library Overhaul**:
    - Custom playlist CRUD and drag-and-drop sequencing.
    - Dedicated `PlaylistDetailScreen` and `ArtistDetailScreen`.
    - 4-tab Library screen (`Playlists`, `Liked Songs`, `Downloads`, `History`).
11. **Phase 8 — Offline Download Manager, 5-Band EQ & Hardware DAC Inspector**:
    - Track & album offline downloading with progress monitoring.
    - 5-band parametric equalizer with audiophile presets (Flat, Bass Boost, Vocal, Acoustic, Electronic).
    - Bit-perfect DSP bypass switch.
    - Hardware DAC inspector displaying active sample rate, bit depth, and output route.
    - Sleep timer with countdown and "End of Track" stop modes.
12. **Phase 9 — Album Detail & Universal Search Discovery**:
    - Dedicated `AlbumDetailScreen` with 1-tap full album downloads.
    - Multi-category search engine (`All`, `Tracks`, `Albums`, `Artists`) with recent search persistence.
13. **Phase 10 — Supabase PostgreSQL Cloud Integration & Auth**:
    - Remote Supabase PostgreSQL 17.6 migration with connection pooling.
    - Dual-mode database adapter with dynamic SQL query translation.
    - `AuraCloudProvider` for remote lossless streaming and cloud catalog queries.
    - User authentication store (`useAuthStore`) with bidirectional library sync.
    - Glassmorphic `AuthModal` and cloud status in `SettingsScreen`.

---

## Getting Started

### Prerequisites

- Node.js 18+ & npm
- Python 3.10+
- Android Studio / Xcode (for mobile simulator/device running)

### Running the Mobile App

```bash
# Navigate to mobile app
cd apps/mobile

# Install dependencies (if needed)
npm install

# Start Expo dev server
npm start
```

### Running the Backend API

```bash
# Navigate to API
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Running Automated Tests

Run the complete test suite across all packages:

```bash
# From workspace root:
npm test:shared   # 11 test suites, 86 tests passed
npm test:mobile   # 15 test suites, 93 tests passed
npm test:api      # 52 pytest tests passed
```
