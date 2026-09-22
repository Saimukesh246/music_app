import type { AudioFormat, AudioQualityInfo, QualityLabel } from "@aura/types";
import { parseFlacMetadata, type FlacTags } from "./parser";

const LOSSLESS_FORMATS: AudioFormat[] = ["FLAC", "ALAC", "WAV"];

/**
 * Extensions we may call lossy without parsing: claiming "Lossy" can only
 * understate quality, never overstate it. Lossless-sounding extensions are
 * deliberately absent — without a parser there is no evidence to justify a
 * lossless claim.
 */
const LOSSY_EXTENSIONS: Record<string, AudioFormat> = {
  mp3: "MP3",
  aac: "AAC",
  m4a: "AAC",
};

export function getQualityLabel(quality: AudioQualityInfo): QualityLabel {
  if (quality.format === "UNKNOWN") return "Unknown";
  if (!LOSSLESS_FORMATS.includes(quality.format)) return "Lossy";
  // A lossless container still needs verified numbers before we grade it.
  if (!quality.bitDepth || !quality.sampleRateHz) return "Unknown";
  const isHiRes = quality.bitDepth > 16 || quality.sampleRateHz > 44100;
  return isHiRes ? "Hi-Res Lossless" : "Lossless";
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function describeAudioFile(
  fileName: string,
  headerBytes: Uint8Array | null
): { quality: AudioQualityInfo; tags: FlacTags } {
  const metadata = headerBytes ? parseFlacMetadata(headerBytes) : null;

  if (metadata) {
    const { streamInfo } = metadata;
    return {
      quality: {
        format: "FLAC",
        bitDepth: streamInfo.bitsPerSample,
        sampleRateHz: streamInfo.sampleRateHz,
        channels: streamInfo.channels,
        durationSec: streamInfo.durationSec,
      },
      tags: metadata.tags,
    };
  }

  const lossyFormat = LOSSY_EXTENSIONS[extensionOf(fileName)];
  return {
    quality: {
      format: lossyFormat ?? "UNKNOWN",
      durationSec: 0,
    },
    tags: {},
  };
}
