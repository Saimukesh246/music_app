# AURA — Phase 8 Design: Offline Download Manager, Equalizer & Audiophile DAC Inspector

Date: 2026-09-23
Status: Approved

## Purpose

Phase 8 elevates AURA's audiophile and mobile experience by introducing offline listening, sound customization with bit-perfect controls, audio route inspection, and playback utilities:

1. **Offline Download Manager**:
   - Remote tracks (Internet Archive or API backend) can be saved to device storage (`expo-file-system`) for seamless offline listening in full lossless quality.
   - SQLite table `downloaded_tracks` tracks `track_id`, `local_uri`, `downloaded_at`, and `file_size_bytes`.
   - `downloadStore` manages state (in-progress downloads, progress 0-100%, cancellation, deletion).
   - Playback routing automatically favors the local downloaded file over network streaming when available.
   - "Downloaded" filter in Library screen allows users to instantly view and play saved tracks without internet access.

2. **Audiophile 5-Band Equalizer & Bit-Perfect Engine**:
   - 5 audiophile frequency bands:
     - 60 Hz (Sub-bass)
     - 230 Hz (Bass warmth)
     - 910 Hz (Mids / vocals)
     - 3.6 kHz (Presence / attack)
     - 14 kHz (Air / treble brilliance)
   - Gain range: -12 dB to +12 dB with smooth curve interpolation.
   - Curated presets: `Flat`, `Bass Boost`, `Vocal Clarity`, `Treble Boost`, `Acoustic`, `Electronic`, `Rock`, `Custom`.
   - **Bit-Perfect Mode Toggle**: Bypasses all DSP / EQ adjustments for true bit-perfect transmission to external DACs.
   - Persisted via `AsyncStorage`.

3. **Audiophile DAC & Output Route Inspector**:
   - Detects and displays active output path (Internal Speakers, Wired Headphones / AUX, Bluetooth, USB DAC).
   - Shows audio stream quality pipeline: source quality (e.g. 24-bit/96kHz FLAC) -> processing mode (Bit-Perfect / EQ Active) -> output route.
   - Accessible from NowPlaying screen and Settings.

4. **Sleep Timer**:
   - Preset durations: 15m, 30m, 45m, 60m, and "End of current track".
   - Integrated into `playerStore` with countdown ticker.
   - Automatically pauses playback when expired.

## Testing Strategy

- Unit tests for `downloadStore` (download queue, progress updates, completion, deletion, storage cleanup).
- Unit tests for `equalizerStore` (preset selection, band value clamping, bit-perfect bypass, persistence).
- Unit tests for `sleepTimer` in `playerStore`.
- Integration tests for playback source resolution (downloaded vs streaming).
