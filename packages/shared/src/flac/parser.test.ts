import { parseFlacMetadata } from "./parser";
import { buildFlacFile, buildStreamInfoData, buildVorbisCommentData } from "./testFixtures";

const STREAMINFO = 0;

function hiResFile() {
  return buildFlacFile([
    {
      type: STREAMINFO,
      data: buildStreamInfoData({
        sampleRateHz: 96000,
        channels: 2,
        bitsPerSample: 24,
        totalSamples: 96000 * 272,
      }),
    },
  ]);
}

describe("parseFlacMetadata — STREAMINFO", () => {
  it("reads sample rate, channels, bit depth and duration", () => {
    const result = parseFlacMetadata(hiResFile());
    expect(result).not.toBeNull();
    expect(result!.streamInfo.sampleRateHz).toBe(96000);
    expect(result!.streamInfo.channels).toBe(2);
    expect(result!.streamInfo.bitsPerSample).toBe(24);
    expect(result!.streamInfo.durationSec).toBe(272);
  });

  it("reads CD-quality 16-bit/44.1kHz correctly", () => {
    const file = buildFlacFile([
      {
        type: STREAMINFO,
        data: buildStreamInfoData({
          sampleRateHz: 44100,
          channels: 2,
          bitsPerSample: 16,
          totalSamples: 44100 * 198,
        }),
      },
    ]);
    const result = parseFlacMetadata(file);
    expect(result!.streamInfo.sampleRateHz).toBe(44100);
    expect(result!.streamInfo.bitsPerSample).toBe(16);
    expect(result!.streamInfo.durationSec).toBe(198);
  });

  it("handles total sample counts above 2^32", () => {
    const file = buildFlacFile([
      {
        type: STREAMINFO,
        data: buildStreamInfoData({
          sampleRateHz: 192000,
          channels: 2,
          bitsPerSample: 24,
          totalSamples: 5_000_000_000,
        }),
      },
    ]);
    const result = parseFlacMetadata(file);
    expect(result!.streamInfo.totalSamples).toBe(5_000_000_000);
  });

  it("returns null when the magic bytes are not fLaC", () => {
    const file = buildFlacFile(
      [
        {
          type: STREAMINFO,
          data: buildStreamInfoData({
            sampleRateHz: 96000,
            channels: 2,
            bitsPerSample: 24,
            totalSamples: 1000,
          }),
        },
      ],
      { magic: [0x49, 0x44, 0x33, 0x04] } // an ID3 tag, i.e. not FLAC
    );
    expect(parseFlacMetadata(file)).toBeNull();
  });

  it("returns null when STREAMINFO is truncated", () => {
    const full = hiResFile();
    expect(parseFlacMetadata(full.subarray(0, 20))).toBeNull();
  });

  it("returns null on an empty buffer", () => {
    expect(parseFlacMetadata(new Uint8Array(0))).toBeNull();
  });

  it("finds STREAMINFO when other blocks precede the last block", () => {
    const padding = { type: 1, data: new Uint8Array(16) };
    const streamInfo = {
      type: STREAMINFO,
      data: buildStreamInfoData({
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        totalSamples: 48000 * 10,
      }),
    };
    const result = parseFlacMetadata(buildFlacFile([streamInfo, padding]));
    expect(result!.streamInfo.sampleRateHz).toBe(48000);
  });
});

const VORBIS_COMMENT = 4;

function fileWithComments(comments: string[]) {
  return buildFlacFile([
    {
      type: STREAMINFO,
      data: buildStreamInfoData({
        sampleRateHz: 44100,
        channels: 2,
        bitsPerSample: 16,
        totalSamples: 44100,
      }),
    },
    { type: VORBIS_COMMENT, data: buildVorbisCommentData(comments) },
  ]);
}

describe("parseFlacMetadata — Vorbis comments", () => {
  it("reads the standard tag fields", () => {
    const result = parseFlacMetadata(
      fileWithComments([
        "TITLE=Low Tide",
        "ARTIST=Nocturne Field",
        "ALBUM=Low Tide Archive",
        "ALBUMARTIST=Nocturne Field",
        "TRACKNUMBER=3",
        "DATE=2024-03-15",
      ])
    );
    expect(result!.tags).toEqual({
      title: "Low Tide",
      artist: "Nocturne Field",
      album: "Low Tide Archive",
      albumArtist: "Nocturne Field",
      trackNumber: 3,
      date: "2024-03-15",
    });
  });

  it("treats tag keys case-insensitively", () => {
    const result = parseFlacMetadata(fileWithComments(["title=lower case key"]));
    expect(result!.tags.title).toBe("lower case key");
  });

  it("decodes non-ASCII tag values", () => {
    const result = parseFlacMetadata(fileWithComments(["ARTIST=Sigur Rós"]));
    expect(result!.tags.artist).toBe("Sigur Rós");
  });

  it("handles a track number given as 3/12", () => {
    const result = parseFlacMetadata(fileWithComments(["TRACKNUMBER=3/12"]));
    expect(result!.tags.trackNumber).toBe(3);
  });

  it("ignores unknown and malformed entries", () => {
    const result = parseFlacMetadata(
      fileWithComments(["REPLAYGAIN_TRACK_GAIN=-6.5 dB", "no-equals-sign", "=novalue"])
    );
    expect(result!.tags).toEqual({});
  });

  it("still returns stream info when there are no comment blocks", () => {
    const result = parseFlacMetadata(fileWithComments([]));
    expect(result!.streamInfo.sampleRateHz).toBe(44100);
    expect(result!.tags).toEqual({});
  });
});
