const MAGIC = [0x66, 0x4c, 0x61, 0x43];
const BLOCK_STREAMINFO = 0;
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

export function parseFlacMetadata(bytes: Uint8Array): FlacMetadata | null {
  if (!hasMagic(bytes)) return null;

  let offset = MAGIC.length;
  let streamInfo: FlacStreamInfo | null = null;

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
    }

    if (isLast) break;
    offset = dataEnd;
  }

  if (!streamInfo) return null;
  return { streamInfo, tags: {} };
}
