import { encodeUtf8 } from "./utf8";

export const FLAC_MAGIC = [0x66, 0x4c, 0x61, 0x43];

export interface StreamInfoValues {
  sampleRateHz: number;
  channels: number;
  bitsPerSample: number;
  totalSamples: number;
}

export function buildStreamInfoData(values: StreamInfoValues): Uint8Array {
  const { sampleRateHz, channels, bitsPerSample, totalSamples } = values;
  const b = new Uint8Array(34);
  // Bytes 0-9 are min/max block size and min/max frame size; zeros parse fine.
  b[10] = (sampleRateHz >> 12) & 0xff;
  b[11] = (sampleRateHz >> 4) & 0xff;
  b[12] =
    ((sampleRateHz & 0x0f) << 4) |
    (((channels - 1) & 0x07) << 1) |
    (((bitsPerSample - 1) >> 4) & 0x01);
  b[13] =
    (((bitsPerSample - 1) & 0x0f) << 4) |
    (Math.floor(totalSamples / 4294967296) & 0x0f);
  const low = totalSamples % 4294967296;
  b[14] = (low >>> 24) & 0xff;
  b[15] = (low >>> 16) & 0xff;
  b[16] = (low >>> 8) & 0xff;
  b[17] = low & 0xff;
  return b;
}

export function buildVorbisCommentData(
  comments: string[],
  vendor = "AURA test"
): Uint8Array {
  const vendorBytes = encodeUtf8(vendor);
  const entries = comments.map(encodeUtf8);
  const size =
    4 + vendorBytes.length + 4 + entries.reduce((n, e) => n + 4 + e.length, 0);
  const b = new Uint8Array(size);
  let o = 0;
  const writeUInt32LE = (value: number) => {
    b[o++] = value & 0xff;
    b[o++] = (value >> 8) & 0xff;
    b[o++] = (value >> 16) & 0xff;
    b[o++] = (value >> 24) & 0xff;
  };
  writeUInt32LE(vendorBytes.length);
  b.set(vendorBytes, o);
  o += vendorBytes.length;
  writeUInt32LE(entries.length);
  for (const entry of entries) {
    writeUInt32LE(entry.length);
    b.set(entry, o);
    o += entry.length;
  }
  return b;
}

export interface BlockSpec {
  type: number;
  data: Uint8Array;
}

/** Assembles a FLAC stream: magic bytes followed by metadata blocks. */
export function buildFlacFile(
  blocks: BlockSpec[],
  options: { magic?: number[] } = {}
): Uint8Array {
  const magic = options.magic ?? FLAC_MAGIC;
  const total =
    magic.length + blocks.reduce((n, block) => n + 4 + block.data.length, 0);
  const b = new Uint8Array(total);
  let o = 0;
  for (const byte of magic) b[o++] = byte;
  blocks.forEach((block, index) => {
    const isLast = index === blocks.length - 1;
    b[o++] = (isLast ? 0x80 : 0x00) | (block.type & 0x7f);
    b[o++] = (block.data.length >> 16) & 0xff;
    b[o++] = (block.data.length >> 8) & 0xff;
    b[o++] = block.data.length & 0xff;
    b.set(block.data, o);
    o += block.data.length;
  });
  return b;
}
