# AURA -- Phase 5 Design: Authorized External Music Providers

Date: 2026-09-22
Status: Implemented

## Purpose

Phase 5 wires the first authorized external music provider into AURA. The original spec
says to inspect the current official developer API/SDK before using any external
provider, and to use OpenTidl only as historical reference -- not as a basis for
bypassing DRM, auth, or access controls.

This phase implements:

1. **Internet Archive provider** (packages/shared/src/providers/internetArchive.ts) --
   completely free, open, no DRM, no registration required. The Internet Archive hosts
   thousands of legally freely-streamable recordings (Live Music Archive, netlabel
   releases, public-domain recordings). It has a documented JSON search API and returns
   direct MP3/FLAC/OGG stream URLs.

2. **Provider registry + runtime selector** (pps/mobile/src/providers/registry.ts) --
   replaces the getProvider() singleton with a multi-provider registry backed by
   AsyncStorage. The user selects their active provider in Settings and it persists
   across restarts. The UI call sites (playerStore, libraryStore, all screens) are
   unchanged -- they all call getProvider() which delegates to the active provider.

3. **Internet Archive backend proxy router** (pps/api/app/routers/ia.py) --
   the mobile app calls the AURA backend rather than the IA API directly. This avoids
   CORS issues on device, enables server-side caching, and matches the spec Section 25
   security architecture (Mobile -> Backend -> Provider API).

4. **Settings screen Music Source picker** -- radio-style selector between Local Library
   and Internet Archive, in a new MUSIC SOURCE section in the Settings screen.

## Non-goals for this phase

- No TIDAL integration (requires application approval from developer.tidal.com).
- No subscription, payment, or DRM of any kind.
- No changes to the local FLAC scanning pipeline.

## Internet Archive API (public, unauthenticated)

`
Search:  GET https://archive.org/advancedsearch.php?q=...&output=json
Item:    GET https://archive.org/metadata/{identifier}
Stream:  https://archive.org/download/{identifier}/{filename}
`

Quality is set from IA actual format field (Flac -> FLAC, VBR MP3 -> MP3).
Bit depth and sample rate are left undefined when not reported by IA -- honest, not fabricated.
FLAC is always preferred over MP3 when both are available.

## Testing

- packages/shared/src/providers/internetArchive.test.ts -- 14 unit tests
  (search mapping, fetch failures, FLAC preference, quality label accuracy,
  recommendations filtering, error messages)
- pps/mobile/src/providers/registry.test.ts -- 6 unit tests
  (default provider, setActiveProvider, getActiveProviderId, getProvider backwards compat)
- pps/api/tests/test_ia.py -- 8 pytest tests
  (search, auth, 502 forwarding, 422 validation, item detail, FLAC preference,
  MP3 fallback, 404 forwarding)
