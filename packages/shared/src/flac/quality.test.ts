import { describeAudioFile } from "./quality";
import { buildFlacFile, buildStreamInfoData } from "./testFixtures";
import { getQualityLabel } from "./quality";

const STREAMINFO = 0;

function flacBytes(sampleRateHz: number, bitsPerSample: number) {
  return buildFlacFile([
    {
      type: STREAMINFO,
      data: buildStreamInfoData({
        sampleRateHz,
        channels: 2,
        bitsPerSample,
        totalSamples: sampleRateHz * 60,
      }),
    },
  ]);
}

describe("describeAudioFile", () => {
  it("reports verified hi-res values from real FLAC bytes", () => {
    const { quality } = describeAudioFile("track.flac", flacBytes(96000, 24));
    expect(quality.format).toBe("FLAC");
    expect(quality.bitDepth).toBe(24);
    expect(quality.sampleRateHz).toBe(96000);
    expect(quality.durationSec).toBe(60);
    expect(getQualityLabel(quality)).toBe("Hi-Res Lossless");
  });

  it("reports CD-quality FLAC as Lossless, not Hi-Res", () => {
    const { quality } = describeAudioFile("track.flac", flacBytes(44100, 16));
    expect(getQualityLabel(quality)).toBe("Lossless");
  });

  // The integrity rule: weak evidence may downgrade, never upgrade.
  it("labels a .flac with bad magic bytes Unknown, never Lossless", () => {
    const notFlac = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    const { quality } = describeAudioFile("liar.flac", notFlac);
    expect(quality.format).toBe("UNKNOWN");
    expect(quality.bitDepth).toBeUndefined();
    expect(getQualityLabel(quality)).toBe("Unknown");
  });

  it("labels a .flac we could not read at all as Unknown", () => {
    const { quality } = describeAudioFile("unreadable.flac", null);
    expect(getQualityLabel(quality)).toBe("Unknown");
  });

  it("labels .mp3 as Lossy from the extension alone", () => {
    const { quality } = describeAudioFile("song.mp3", null);
    expect(quality.format).toBe("MP3");
    expect(getQualityLabel(quality)).toBe("Lossy");
  });

  it("labels .m4a and .aac as Lossy", () => {
    expect(getQualityLabel(describeAudioFile("a.m4a", null).quality)).toBe("Lossy");
    expect(getQualityLabel(describeAudioFile("b.aac", null).quality)).toBe("Lossy");
  });

  // No parser for these yet, so there is no evidence, so no lossless claim.
  it("labels .wav and .alac Unknown rather than assuming lossless", () => {
    expect(getQualityLabel(describeAudioFile("a.wav", null).quality)).toBe("Unknown");
    expect(getQualityLabel(describeAudioFile("b.alac", null).quality)).toBe("Unknown");
  });

  it("reports duration 0 when it is unknown", () => {
    const { quality } = describeAudioFile("song.mp3", null);
    expect(quality.durationSec).toBe(0);
  });

  it("returns parsed tags alongside the quality", () => {
    const { tags } = describeAudioFile("track.flac", flacBytes(96000, 24));
    expect(tags).toEqual({});
  });
});
