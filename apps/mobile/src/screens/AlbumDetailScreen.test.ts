import type { Track, Album } from "@aura/types";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min${m !== 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h} hr${h !== 1 ? "s" : ""}${remM > 0 ? ` ${remM} min${remM !== 1 ? "s" : ""}` : ""}`;
}

describe("AlbumDetailScreen helpers & logic", () => {
  const mockAlbum: Album = {
    id: "alb-1",
    title: "Kind of Blue",
    artistId: "art-1",
    artistName: "Miles Davis",
    releaseYear: 1959,
  };

  const mockTracks: Track[] = [
    {
      id: "t2",
      title: "Freddie Freeloader",
      artistId: "art-1",
      artistName: "Miles Davis",
      albumId: "alb-1",
      albumTitle: "Kind of Blue",
      quality: {
        format: "FLAC",
        durationSec: 589,
        bitDepth: 24,
        sampleRateHz: 96000,
        trackNumber: 2,
      } as any,
    },
    {
      id: "t1",
      title: "So What",
      artistId: "art-1",
      artistName: "Miles Davis",
      albumId: "alb-1",
      albumTitle: "Kind of Blue",
      quality: {
        format: "FLAC",
        durationSec: 562,
        bitDepth: 24,
        sampleRateHz: 96000,
        trackNumber: 1,
      } as any,
    },
    {
      id: "t3",
      title: "Other Song",
      artistId: "art-2",
      artistName: "John Coltrane",
      albumId: "alb-2",
      albumTitle: "Blue Train",
      quality: { format: "FLAC", durationSec: 300 } as any,
    },
  ];

  it("filters and sorts album tracks by trackNumber", () => {
    const albumTracks = mockTracks
      .filter((t) => t.albumId === "alb-1")
      .sort((a, b) => {
        const numA = (a.quality as any).trackNumber ?? 0;
        const numB = (b.quality as any).trackNumber ?? 0;
        return numA - numB;
      });

    expect(albumTracks).toHaveLength(2);
    expect(albumTracks[0].title).toBe("So What");
    expect(albumTracks[1].title).toBe("Freddie Freeloader");
  });

  it("calculates total duration and formats properly", () => {
    const albumTracks = mockTracks.filter((t) => t.albumId === "alb-1");
    const totalSec = albumTracks.reduce(
      (sum, t) => sum + (t.quality.durationSec || 0),
      0
    );
    expect(totalSec).toBe(1151); // 19m 11s
    expect(formatDuration(totalSec)).toBe("19 mins");
  });

  it("formats multi-hour album duration properly", () => {
    expect(formatDuration(3600)).toBe("1 hr");
    expect(formatDuration(3900)).toBe("1 hr 5 mins");
  });

  it("filters out already-downloaded tracks for batch download", () => {
    const albumTracks = mockTracks.filter((t) => t.albumId === "alb-1");
    const downloadedSet = new Set(["t1"]);

    const pending = albumTracks.filter((t) => !downloadedSet.has(t.id));
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("t2");
  });
});
