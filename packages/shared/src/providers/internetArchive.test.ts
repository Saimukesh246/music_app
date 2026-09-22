import { InternetArchiveProvider } from "./internetArchive";

// ---------------------------------------------------------------------------
// Minimal fetch mock helpers
// ---------------------------------------------------------------------------

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

type FetchFn = (url: string) => Promise<Response>;

function mockFetch(handler: (url: string) => { body: unknown; status?: number }): FetchFn {
  return async (url: string) => {
    const { body, status = 200 } = handler(url);
    return makeResponse(body, status);
  };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const IA_SEARCH_RESPONSE = {
  response: {
    docs: [
      {
        identifier: "gd1977-05-08",
        title: "Grateful Dead Live at Barton Hall",
        creator: "Grateful Dead",
        collection: ["GratefulDead", "etree"],
      },
    ],
    numFound: 1,
  },
};

const IA_METADATA_RESPONSE = {
  metadata: {
    identifier: "gd1977-05-08",
    title: "Grateful Dead Live at Barton Hall 1977",
    creator: "Grateful Dead",
    collection: ["GratefulDead"],
  },
  files: [
    { name: "gd77-05-08d1t01.flac", format: "Flac", length: "5:32", size: "24000000" },
    { name: "gd77-05-08d1t01.mp3", format: "VBR MP3", length: "5:32", bitrate: "192" },
  ],
};

const IA_METADATA_MP3_ONLY = {
  metadata: {
    identifier: "some-mp3-item",
    title: "Some MP3 Only Item",
    creator: "Some Artist",
  },
  files: [
    { name: "track01.mp3", format: "128Kbps MP3", length: "3:00", bitrate: "128" },
  ],
};

const IA_METADATA_NO_AUDIO = {
  metadata: {
    identifier: "no-audio-item",
    title: "Text Only Item",
  },
  files: [
    { name: "readme.txt", format: "Text" },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InternetArchiveProvider — search()", () => {
  it("maps IA search response to AURA SearchResults", async () => {
    const fetch = mockFetch(() => ({ body: IA_SEARCH_RESPONSE }));
    const provider = new InternetArchiveProvider(fetch);

    const results = await provider.search("grateful dead");

    expect(results.tracks).toHaveLength(1);
    expect(results.tracks[0]).toMatchObject({
      id: "gd1977-05-08",
      title: "Grateful Dead Live at Barton Hall",
      artistName: "Grateful Dead",
    });
    expect(results.artists).toHaveLength(1);
    expect(results.artists[0]).toMatchObject({ name: "Grateful Dead" });
  });

  it("returns empty results when fetch fails", async () => {
    const fetch: FetchFn = async () => {
      throw new Error("network error");
    };
    const provider = new InternetArchiveProvider(fetch);
    const results = await provider.search("anything");
    expect(results.tracks).toHaveLength(0);
    expect(results.artists).toHaveLength(0);
  });

  it("returns empty results when IA returns non-200", async () => {
    const fetch = mockFetch(() => ({ body: {}, status: 503 }));
    const provider = new InternetArchiveProvider(fetch);
    const results = await provider.search("anything");
    expect(results.tracks).toHaveLength(0);
  });

  it("returns empty results for blank query", async () => {
    const fetch = mockFetch(() => ({ body: IA_SEARCH_RESPONSE }));
    const provider = new InternetArchiveProvider(fetch);
    const results = await provider.search("  ");
    expect(results.tracks).toHaveLength(0);
  });
});

describe("InternetArchiveProvider — getPlaybackSource()", () => {
  it("picks FLAC over MP3 when both are present", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_RESPONSE }));
    const provider = new InternetArchiveProvider(fetch);

    const source = await provider.getPlaybackSource("gd1977-05-08");

    expect(source.uri).toContain("gd77-05-08d1t01.flac");
    expect(source.quality.format).toBe("FLAC");
  });

  it("falls back to MP3 when no FLAC is present", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_MP3_ONLY }));
    const provider = new InternetArchiveProvider(fetch);

    const source = await provider.getPlaybackSource("some-mp3-item");

    expect(source.uri).toContain(".mp3");
    expect(source.quality.format).toBe("MP3");
  });

  it("throws a user-readable error when no audio file is found", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_NO_AUDIO }));
    const provider = new InternetArchiveProvider(fetch);

    await expect(provider.getPlaybackSource("no-audio-item")).rejects.toThrow(
      /No playable audio file found/
    );
  });

  it("throws a user-readable error on network failure", async () => {
    const fetch: FetchFn = async () => {
      throw new Error("offline");
    };
    const provider = new InternetArchiveProvider(fetch);
    await expect(provider.getPlaybackSource("any-id")).rejects.toThrow(/Network error/);
  });
});

describe("InternetArchiveProvider — quality labels", () => {
  it("labels FLAC quality as Lossless (format=FLAC)", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_RESPONSE }));
    const provider = new InternetArchiveProvider(fetch);
    const track = await provider.getTrack("gd1977-05-08");
    expect(track.quality.format).toBe("FLAC");
  });

  it("labels MP3-only quality as MP3 (Lossy)", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_MP3_ONLY }));
    const provider = new InternetArchiveProvider(fetch);
    const track = await provider.getTrack("some-mp3-item");
    expect(track.quality.format).toBe("MP3");
  });

  it("does not fabricate bit depth or sample rate for MP3", async () => {
    const fetch = mockFetch(() => ({ body: IA_METADATA_MP3_ONLY }));
    const provider = new InternetArchiveProvider(fetch);
    const track = await provider.getTrack("some-mp3-item");
    expect(track.quality.bitDepth).toBeUndefined();
    expect(track.quality.sampleRateHz).toBeUndefined();
  });
});

describe("InternetArchiveProvider — getRecommendations()", () => {
  it("returns tracks not in the seed set", async () => {
    const fetch = mockFetch(() => ({ body: IA_SEARCH_RESPONSE }));
    const provider = new InternetArchiveProvider(fetch);
    const recs = await provider.getRecommendations({ trackIds: ["gd1977-05-08"] });
    const ids = recs.map((t) => t.id);
    expect(ids).not.toContain("gd1977-05-08");
  });
});
