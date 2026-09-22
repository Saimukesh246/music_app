import { getFrontCoverUrl } from "./coverArt";

describe("getFrontCoverUrl", () => {
  it("returns the front cover URL when art exists", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    const url = await getFrontCoverUrl(fetchFn, "release-mbid-123");

    expect(url).toBe("https://coverartarchive.org/release/release-mbid-123/front");
  });

  it("returns null when there is no cover art (404)", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await getFrontCoverUrl(fetchFn, "release-mbid-123")).toBeNull();
  });

  it("returns null when the network request throws", async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    expect(await getFrontCoverUrl(fetchFn, "release-mbid-123")).toBeNull();
  });
});
