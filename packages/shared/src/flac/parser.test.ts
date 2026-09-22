import { parseFlacMetadata } from "./parser";
import { buildFlacFile, buildStreamInfoData } from "./testFixtures";

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
