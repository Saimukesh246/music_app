import { searchTrack, getAudioFeatures } from "./reccobeats";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("searchTrack", () => {
  it("returns the first match's id", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [{ id: "recco-123" }] }) });
    expect(await searchTrack(fetchFn, "Low Tide", "Nocturne Field")).toBe("recco-123");
  });

  it("returns null when there are no results", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [] }) });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 404 });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await searchTrack(fetchFn, "x", "y")).toBeNull();
  });
});

describe("getAudioFeatures", () => {
  it("returns a map keyed by track id", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        content: [
          {
            id: "recco-123",
            acousticness: 0.5,
            danceability: 0.6,
            energy: 0.7,
            instrumentalness: 0.1,
            valence: 0.4,
            tempo: 120,
          },
        ],
      }),
    });

    const result = await getAudioFeatures(fetchFn, ["recco-123"]);

    expect(result.get("recco-123")).toEqual({
      acousticness: 0.5,
      danceability: 0.6,
      energy: 0.7,
      instrumentalness: 0.1,
      valence: 0.4,
      tempo: 120,
    });
  });

  it("returns an empty map on a non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 400 });
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("returns an empty map when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("skips entries with no id in the response", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [{ acousticness: 0.5 }] }) });
    expect((await getAudioFeatures(fetchFn, ["x"])).size).toBe(0);
  });

  it("sends every id as a repeated query parameter", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ content: [] }) });
    await getAudioFeatures(fetchFn, ["a", "b"]);
    const [url] = fetchFn.mock.calls[0];
    expect(url).toContain("ids=a");
    expect(url).toContain("ids=b");
  });
});
