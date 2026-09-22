import { render, screen } from "@testing-library/react-native";
import { QualityBadge, getQualityLabel } from "./QualityBadge";
import type { AudioQualityInfo } from "@aura/types";

const hiRes: AudioQualityInfo = {
  format: "FLAC",
  bitDepth: 24,
  sampleRateHz: 96000,
  channels: 2,
  durationSec: 200,
};

const cdLossless: AudioQualityInfo = {
  format: "FLAC",
  bitDepth: 16,
  sampleRateHz: 44100,
  channels: 2,
  durationSec: 200,
};

const lossy: AudioQualityInfo = {
  format: "MP3",
  bitrateKbps: 320,
  durationSec: 200,
};

const unknown: AudioQualityInfo = {
  format: "UNKNOWN",
  durationSec: 200,
};

describe("getQualityLabel", () => {
  it("labels 24-bit/96kHz FLAC as Hi-Res Lossless", () => {
    expect(getQualityLabel(hiRes)).toBe("Hi-Res Lossless");
  });

  it("labels 16-bit/44.1kHz FLAC as Lossless", () => {
    expect(getQualityLabel(cdLossless)).toBe("Lossless");
  });

  it("labels MP3 as Lossy", () => {
    expect(getQualityLabel(lossy)).toBe("Lossy");
  });

  it("labels UNKNOWN format as Unknown", () => {
    expect(getQualityLabel(unknown)).toBe("Unknown");
  });
});

describe("QualityBadge", () => {
  it("renders the Hi-Res Lossless label and format/rate detail", () => {
    render(<QualityBadge quality={hiRes} />);
    expect(screen.getByText("Hi-Res Lossless")).toBeTruthy();
    expect(screen.getByText("FLAC · 24-bit / 96 kHz")).toBeTruthy();
  });

  it("renders Lossy label with bitrate detail", () => {
    render(<QualityBadge quality={lossy} />);
    expect(screen.getByText("Lossy")).toBeTruthy();
    expect(screen.getByText("MP3 · 320 kbps")).toBeTruthy();
  });

  it("renders an Unknown badge for unparseable audio", () => {
    render(<QualityBadge quality={{ format: "UNKNOWN", durationSec: 0 }} />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
