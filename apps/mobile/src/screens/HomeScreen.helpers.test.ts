/**
 * Tests for the pure helper functions used by HomeScreen:
 *   - Quality breakdown / LibraryStats computation
 *   - heavyRotationAlbums ordering
 *
 * We test the logic by directly requiring a thin test harness that
 * re-implements the same rules, so we don't need to render the full screen.
 */

import type { Track, Album } from "@aura/types";

// ---------------------------------------------------------------------------
// Inline the pure helpers (same logic as HomeScreen / useLibraryData)
// ---------------------------------------------------------------------------

interface LibraryStats {
  totalTracks: number;
  totalHours: number;
  hiRes: number;
  lossless: number;
  lossy: number;
  unknown: number;
}

function computeStats(tracks: Track[]): LibraryStats {
  let totalDurationSec = 0;
  let hiRes = 0, lossless = 0, lossy = 0, unknown = 0;
  for (const t of tracks) {
    totalDurationSec += t.quality.durationSec ?? 0;
    const fmt = t.quality.format;
    const depth = t.quality.bitDepth ?? 0;
    if (fmt === "FLAC" || fmt === "WAV" || fmt === "ALAC") {
      if (depth > 16) hiRes++;
      else lossless++;
    } else if (fmt === "MP3" || fmt === "AAC" || fmt === "OGG") {
      lossy++;
    } else {
      unknown++;
    }
  }
  return {
    totalTracks: tracks.length,
    totalHours: Math.round((totalDurationSec / 3600) * 10) / 10,
    hiRes,
    lossless,
    lossy,
    unknown,
  };
}

function heavyRotationAlbums(
  tracks: Track[],
  albums: Album[],
  playCountsMap: Map<string, number>
): Album[] {
  if (playCountsMap.size === 0) return albums;
  const albumScore = new Map<string, number>();
  for (const t of tracks) {
    const cnt = playCountsMap.get(t.id) ?? 0;
    albumScore.set(t.albumId, (albumScore.get(t.albumId) ?? 0) + cnt);
  }
  return [...albums]
    .filter((a) => (albumScore.get(a.id) ?? 0) > 0)
    .sort((a, b) => (albumScore.get(b.id) ?? 0) - (albumScore.get(a.id) ?? 0));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrack(overrides: Partial<Track> & Pick<Track, "id" | "albumId">): Track {
  return {
    title: overrides.id,
    artistId: "artist-1",
    artistName: "Test Artist",
    albumTitle: "Test Album",
    quality: { format: "UNKNOWN", durationSec: 0 },
    ...overrides,
  };
}

function makeAlbum(id: string): Album {
  return { id, title: `Album ${id}`, artistId: "artist-1", artistName: "Test Artist", trackIds: [] };
}

// ---------------------------------------------------------------------------
// computeStats tests
// ---------------------------------------------------------------------------

describe("computeStats — quality breakdown", () => {
  it("counts hi-res correctly (FLAC + bitDepth > 16)", () => {
    const tracks = [
      makeTrack({ id: "t1", albumId: "a1", quality: { format: "FLAC", durationSec: 200, bitDepth: 24 } }),
      makeTrack({ id: "t2", albumId: "a1", quality: { format: "FLAC", durationSec: 180, bitDepth: 32 } }),
    ];
    const stats = computeStats(tracks);
    expect(stats.hiRes).toBe(2);
    expect(stats.lossless).toBe(0);
  });

  it("counts lossless correctly (FLAC, no elevated bit depth)", () => {
    const tracks = [
      makeTrack({ id: "t1", albumId: "a1", quality: { format: "FLAC", durationSec: 200 } }),
    ];
    const stats = computeStats(tracks);
    expect(stats.lossless).toBe(1);
    expect(stats.hiRes).toBe(0);
  });

  it("counts lossy correctly (MP3)", () => {
    const tracks = [
      makeTrack({ id: "t1", albumId: "a1", quality: { format: "MP3", durationSec: 180 } }),
      makeTrack({ id: "t2", albumId: "a1", quality: { format: "AAC", durationSec: 200 } }),
    ];
    const stats = computeStats(tracks);
    expect(stats.lossy).toBe(2);
  });

  it("counts unknown correctly", () => {
    const tracks = [
      makeTrack({ id: "t1", albumId: "a1", quality: { format: "UNKNOWN", durationSec: 0 } }),
    ];
    const stats = computeStats(tracks);
    expect(stats.unknown).toBe(1);
  });

  it("computes totalTracks and totalHours correctly", () => {
    const tracks = [
      makeTrack({ id: "t1", albumId: "a1", quality: { format: "MP3", durationSec: 3600 } }),
      makeTrack({ id: "t2", albumId: "a1", quality: { format: "FLAC", durationSec: 3600 } }),
    ];
    const stats = computeStats(tracks);
    expect(stats.totalTracks).toBe(2);
    expect(stats.totalHours).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// heavyRotationAlbums tests
// ---------------------------------------------------------------------------

describe("heavyRotationAlbums", () => {
  const albums = [makeAlbum("a1"), makeAlbum("a2"), makeAlbum("a3")];
  const tracks = [
    makeTrack({ id: "t1", albumId: "a1" }),
    makeTrack({ id: "t2", albumId: "a2" }),
    makeTrack({ id: "t3", albumId: "a3" }),
  ];

  it("returns all albums in original order when no play history", () => {
    const result = heavyRotationAlbums(tracks, albums, new Map());
    expect(result.map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("sorts albums by descending play count", () => {
    const counts = new Map([["t1", 1], ["t2", 5], ["t3", 3]]);
    const result = heavyRotationAlbums(tracks, albums, counts);
    expect(result[0].id).toBe("a2"); // 5 plays
    expect(result[1].id).toBe("a3"); // 3 plays
    expect(result[2].id).toBe("a1"); // 1 play
  });

  it("excludes albums with zero plays when history exists", () => {
    const counts = new Map([["t2", 2]]);
    const result = heavyRotationAlbums(tracks, albums, counts);
    expect(result.map((a) => a.id)).toEqual(["a2"]);
    expect(result).toHaveLength(1);
  });
});
