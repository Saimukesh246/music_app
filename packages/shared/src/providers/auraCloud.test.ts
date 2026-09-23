import { AuraCloudProvider } from "./auraCloud";

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("AuraCloudProvider", () => {
  const BASE_URL = "http://localhost:8000";
  const TEST_TOKEN = "jwt.test.token";

  it("attaches Authorization header when token is supplied", async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetchMock = async (url: string, init?: any) => {
      capturedHeaders = init?.headers || {};
      return makeResponse({ tracks: [], albums: [], artists: [] });
    };

    const provider = new AuraCloudProvider({
      getBaseUrl: () => BASE_URL,
      getToken: () => TEST_TOKEN,
      fetch: fetchMock as any,
    });

    await provider.search("ambient");
    expect(capturedHeaders["Authorization"]).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("parses search results with proper type mappings", async () => {
    const fetchMock = async (url: string) => {
      if (url.includes("/search")) {
        return makeResponse({
          artists: [{ id: 1, name: "Solar Fields" }],
          albums: [{ id: 10, title: "Movements", artist_id: 1, artist_name: "Solar Fields", release_date: "2009" }],
          tracks: [
            {
              id: 100,
              title: "Sol",
              artist_id: 1,
              artist_name: "Solar Fields",
              album_id: 10,
              album_title: "Movements",
              duration_sec: 480.0,
            },
          ],
        });
      }
      return makeResponse({}, 404);
    };

    const provider = new AuraCloudProvider({
      getBaseUrl: () => BASE_URL,
      fetch: fetchMock as any,
    });

    const results = await provider.search("Solar");
    expect(results.artists).toHaveLength(1);
    expect(results.artists[0].name).toBe("Solar Fields");
    expect(results.albums).toHaveLength(1);
    expect(results.albums[0].title).toBe("Movements");
    expect(results.tracks).toHaveLength(1);
    expect(results.tracks[0].title).toBe("Sol");
    expect(results.tracks[0].quality.format).toBe("FLAC");
    expect(results.tracks[0].quality.durationSec).toBe(480.0);
  });

  it("fetches single artist, album, and track", async () => {
    const fetchMock = async (url: string) => {
      if (url.includes("/artists/1")) {
        return makeResponse({ id: 1, name: "Carbon Based Lifeforms" });
      }
      if (url.includes("/albums/2")) {
        return makeResponse({
          id: 2,
          title: "World of Sleepers",
          artist_id: 1,
          artist_name: "Carbon Based Lifeforms",
          track_ids: [201, 202],
        });
      }
      if (url.includes("/tracks/201")) {
        return makeResponse({
          id: 201,
          title: "Photosynthesis",
          artist_id: 1,
          artist_name: "Carbon Based Lifeforms",
          album_id: 2,
          album_title: "World of Sleepers",
          duration_sec: 341.0,
        });
      }
      return makeResponse({ detail: "Not found" }, 404);
    };

    const provider = new AuraCloudProvider({
      getBaseUrl: () => BASE_URL,
      fetch: fetchMock as any,
    });

    const artist = await provider.getArtist("1");
    expect(artist.name).toBe("Carbon Based Lifeforms");

    const album = await provider.getAlbum("2");
    expect(album.title).toBe("World of Sleepers");
    expect(album.trackIds).toEqual(["201", "202"]);

    const track = await provider.getTrack("201");
    expect(track.title).toBe("Photosynthesis");
    expect(track.quality.durationSec).toBe(341.0);
  });

  it("constructs playback source with stream url and token query parameter", async () => {
    const fetchMock = async (url: string) => {
      if (url.includes("/tracks/50")) {
        return makeResponse({
          id: 50,
          title: "Lossless Master",
          artist_id: 5,
          artist_name: "Test Artist",
          album_id: 15,
          album_title: "Test Album",
          duration_sec: 210.0,
        });
      }
      return makeResponse({}, 404);
    };

    const provider = new AuraCloudProvider({
      getBaseUrl: () => "http://10.0.2.2:8000/",
      getToken: () => "secret_token_123",
      fetch: fetchMock as any,
    });

    const source = await provider.getPlaybackSource("50");
    expect(source.trackId).toBe("50");
    expect(source.uri).toBe("http://10.0.2.2:8000/stream/50?token=secret_token_123");
    expect(source.quality.format).toBe("FLAC");
  });

  it("fetches recommendations with seed track id", async () => {
    let capturedUrl = "";
    const fetchMock = async (url: string) => {
      capturedUrl = url;
      return makeResponse([
        {
          id: 99,
          title: "Recommended Track",
          artist_id: 1,
          artist_name: "Artist",
          album_id: 1,
          album_title: "Album",
          duration_sec: 180.0,
        },
      ]);
    };

    const provider = new AuraCloudProvider({
      getBaseUrl: () => BASE_URL,
      fetch: fetchMock as any,
    });

    const recs = await provider.getRecommendations({ trackIds: ["42"] });
    expect(capturedUrl).toContain("seed_track_id=42");
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe("Recommended Track");
  });
});
