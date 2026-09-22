import { getLyrics } from "./lrclib";

function fakeFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 404),
    json: response.json ?? (async () => ({})),
  });
}

describe("getLyrics", () => {
  it("returns plain and synced lyrics on a match", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      json: async () => ({
        instrumental: false,
        plainLyrics: "Line one\nLine two",
        syncedLyrics: "[00:01.00]Line one\n[00:05.00]Line two",
      }),
    });

    const result = await getLyrics(fetchFn, {
      trackName: "Low Tide",
      artistName: "Nocturne Field",
      albumName: "Low Tide Archive",
      durationSec: 272.4,
    });

    expect(result).toEqual({
      plainLyrics: "Line one\nLine two",
      syncedLyrics: "[00:01.00]Line one\n[00:05.00]Line two",
      instrumental: false,
    });
  });

  it("returns instrumental: true with no lyrics text", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: true }) });

    const result = await getLyrics(fetchFn, {
      trackName: "Interlude",
      artistName: "Nocturne Field",
      durationSec: 90,
    });

    expect(result).toEqual({ instrumental: true, plainLyrics: undefined, syncedLyrics: undefined });
  });

  it("returns null on a 404 (no match)", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 404 });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null on any other non-200 response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 429 });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("returns null when the JSON body is malformed", async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(
      await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 })
    ).toBeNull();
  });

  it("rounds the duration and sends it as a query parameter", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: false }) });

    await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 272.6 });

    const [url] = fetchFn.mock.calls[0];
    expect(url).toContain("duration=273");
  });

  it("sends a descriptive User-Agent header", async () => {
    const fetchFn = fakeFetch({ ok: true, json: async () => ({ instrumental: false }) });

    await getLyrics(fetchFn, { trackName: "x", artistName: "y", durationSec: 100 });

    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("AURA");
  });
});
