import { recommendTracks } from "./recommend";
import type { Track, AudioFeatures } from "@aura/types";

function makeTrack(id: string, features?: Partial<AudioFeatures>): Track {
  return {
    id,
    title: id,
    artistId: "artist-1",
    artistName: "Artist",
    albumId: "album-1",
    albumTitle: "Album",
    quality: { format: "FLAC", durationSec: 200 },
    audioFeatures: features
      ? {
          acousticness: 0,
          danceability: 0,
          energy: 0,
          instrumentalness: 0,
          valence: 0,
          tempo: 120,
          ...features,
        }
      : undefined,
  };
}

describe("recommendTracks", () => {
  it("ranks candidates by closeness to the seed centroid", () => {
    const seed = makeTrack("seed", { energy: 0.9, valence: 0.9 });
    const close = makeTrack("close", { energy: 0.85, valence: 0.85 });
    const far = makeTrack("far", { energy: 0.1, valence: 0.1 });

    const result = recommendTracks([close, far], [seed], 2);

    expect(result.map((t) => t.id)).toEqual(["close", "far"]);
  });

  it("excludes the seed tracks themselves from the results", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const other = makeTrack("other", { energy: 0.5 });

    const result = recommendTracks([seed, other], [seed], 5);

    expect(result.map((t) => t.id)).toEqual(["other"]);
  });

  it("returns an empty array when no seeds have audio features", () => {
    const seed = makeTrack("seed");
    const candidate = makeTrack("candidate", { energy: 0.5 });

    expect(recommendTracks([candidate], [seed], 5)).toEqual([]);
  });

  it("skips candidates with no audio features", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const featureless = makeTrack("featureless");
    const featured = makeTrack("featured", { energy: 0.5 });

    const result = recommendTracks([featureless, featured], [seed], 5);

    expect(result.map((t) => t.id)).toEqual(["featured"]);
  });

  it("respects the requested count", () => {
    const seed = makeTrack("seed", { energy: 0.5 });
    const candidates = [
      makeTrack("a", { energy: 0.5 }),
      makeTrack("b", { energy: 0.5 }),
      makeTrack("c", { energy: 0.5 }),
    ];

    expect(recommendTracks(candidates, [seed], 2)).toHaveLength(2);
  });

  it("averages multiple seeds into one centroid", () => {
    const seedA = makeTrack("seedA", { energy: 0.0 });
    const seedB = makeTrack("seedB", { energy: 1.0 });
    const mid = makeTrack("mid", { energy: 0.5 });
    const extreme = makeTrack("extreme", { energy: 0.95 });

    const result = recommendTracks([extreme, mid], [seedA, seedB], 2);

    expect(result.map((t) => t.id)).toEqual(["mid", "extreme"]);
  });
});
