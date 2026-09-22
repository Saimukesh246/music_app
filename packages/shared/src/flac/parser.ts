import { decodeUtf8 } from "./utf8";

const MAGIC = [0x66, 0x4c, 0x61, 0x43];
const BLOCK_STREAMINFO = 0;
const BLOCK_VORBIS_COMMENT = 4;
const STREAMINFO_SIZE = 34;

export interface FlacStreamInfo {
  sampleRateHz: number;
  channels: number;
  bitsPerSample: number;
  totalSamples: number;
  durationSec: number;
}

export interface FlacTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  trackNumber?: number;
  date?: string;
}

export interface FlacMetadata {
  streamInfo: FlacStreamInfo;
  tags: FlacTags;
}

function hasMagic(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

function parseStreamInfo(data: Uint8Array): FlacStreamInfo | null {
  if (data.length < STREAMINFO_SIZE) return null;
  const sampleRateHz = (data[10] << 12) | (data[11] << 4) | (data[12] >> 4);
  const channels = ((data[12] >> 1) & 0x07) + 1;
  const bitsPerSample = (((data[12] & 0x01) << 4) | (data[13] >> 4)) + 1;
  const highBits = data[13] & 0x0f;
  const lowBits =
    ((data[14] << 24) >>> 0) + (data[15] << 16) + (data[16] << 8) + data[17];
  const totalSamples = highBits * 4294967296 + lowBits;
  if (sampleRateHz === 0) return null;
  return {
    sampleRateHz,
    channels,
    bitsPerSample,
    totalSamples,
    durationSec: totalSamples / sampleRateHz,
  };
}

function readUInt32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

function parseVorbisComment(data: Uint8Array): FlacTags {
  const tags: FlacTags = {};
  if (data.length < 8) return tags;

  let offset = 0;
  const vendorLength = readUInt32LE(data, offset);
  offset += 4 + vendorLength;
  if (offset + 4 > data.length) return tags;

  const count = readUInt32LE(data, offset);
  offset += 4;

  for (let i = 0; i < count; i++) {
    if (offset + 4 > data.length) break;
    const length = readUInt32LE(data, offset);
    offset += 4;
    if (offset + length > data.length) break;

    const entry = decodeUtf8(data.subarray(offset, offset + length));
    offset += length;

    const equals = entry.indexOf("=");
    if (equals <= 0) continue;
    const key = entry.slice(0, equals).toUpperCase();
    const value = entry.slice(equals + 1);
    if (!value) continue;

    switch (key) {
      case "TITLE":
        tags.title = value;
        break;
      case "ARTIST":
        tags.artist = value;
        break;
      case "ALBUM":
        tags.album = value;
        break;
      case "ALBUMARTIST":
        tags.albumArtist = value;
        break;
      case "DATE":
        tags.date = value;
        break;
      case "TRACKNUMBER": {
        // Track numbers are often written as "3/12".
        const parsed = parseInt(value.split("/")[0], 10);
        if (Number.isFinite(parsed)) tags.trackNumber = parsed;
        break;
      }
    }
  }

  return tags;
}

export function parseFlacMetadata(bytes: Uint8Array): FlacMetadata | null {
  if (!hasMagic(bytes)) return null;

  let offset = MAGIC.length;
  let streamInfo: FlacStreamInfo | null = null;
  let tags: FlacTags = {};

  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const length =
      (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const dataStart = offset + 4;
    const dataEnd = dataStart + length;

    // A block running past what we were given means the buffer is truncated.
    // Stop and keep whatever complete blocks we already read.
    if (dataEnd > bytes.length) break;

    if (type === BLOCK_STREAMINFO) {
      streamInfo = parseStreamInfo(bytes.subarray(dataStart, dataEnd));
    } else if (type === BLOCK_VORBIS_COMMENT) {
      tags = parseVorbisComment(bytes.subarray(dataStart, dataEnd));
    }

    if (isLast) break;
    offset = dataEnd;
  }

  if (!streamInfo) return null;
  return { streamInfo, tags };
}
