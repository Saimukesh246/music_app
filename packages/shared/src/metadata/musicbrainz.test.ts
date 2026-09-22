import { searchRelease } from "./musicbrainz";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("searchRelease", () => {
  it("returns the release and artist MBIDs plus release date on a match", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        releases: [
          {
            id: "release-mbid-123",
            date: "2024-03-15",
            "artist-credit": [{ artist: { id: "artist-mbid-456" } }],
          },
        ],
      }),
    });

    const result = await searchRelease(fetchFn, "Nocturne Field", "Low Tide Archive");

    expect(result).toEqual({
      releaseMbid: "release-mbid-123",
      artistMbid: "artist-mbid-456",
      releaseDate: "2024-03-15",
    });
  });

  it("returns null when there are no matching releases", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ releases: [] }) });
    expect(await searchRelease(fetchFn, "Unknown Artist", "Unknown Album")).toBeNull();
  });

  it("returns null when the response is not ok", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 503 });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("returns null when a matched release has no artist credit", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({ releases: [{ id: "release-mbid-123", date: "2024" }] }),
    });
    expect(await searchRelease(fetchFn, "Artist", "Album")).toBeNull();
  });

  it("sends a descriptive User-Agent header", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        releases: [{ id: "r1", "artist-credit": [{ artist: { id: "a1" } }] }],
      }),
    });

    await searchRelease(fetchFn, "Artist", "Album");

    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("AURA");
  });
});
