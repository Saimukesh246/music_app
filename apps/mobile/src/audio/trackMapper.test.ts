import { toRNTPTrack } from "./trackMapper";
import { tracks } from "@aura/shared";

describe("toRNTPTrack", () => {
  it("maps the fields RNTP needs, keyed by the app track id", () => {
    const track = tracks[0];
    const result = toRNTPTrack(track, "content://mock/track-1");
    expect(result).toEqual({
      id: track.id,
      url: "content://mock/track-1",
      title: track.title,
      artist: track.artistName,
      artwork: track.artworkUrl,
      duration: track.quality.durationSec,
    });
  });

  it("omits artwork rather than passing undefined explicitly when there is none", () => {
    const track = { ...tracks[0], artworkUrl: undefined };
    const result = toRNTPTrack(track, "content://mock/track-1");
    expect(result.artwork).toBeUndefined();
  });
});
