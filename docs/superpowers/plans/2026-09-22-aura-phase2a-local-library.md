# AURA Phase 2a Implementation Plan — Local Library Data Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixture data with a real local music library — imported from
a device folder, with audio quality parsed from actual FLAC bytes and persisted
in SQLite — served to the existing Phase 1 screens through `MusicProvider`.

**Architecture:** A dependency-free FLAC parser in `packages/shared` turns raw
header bytes into verified stream info and tags. A scanner in `apps/mobile`
walks an Android Storage Access Framework directory, reads only each file's
first 64KB, and writes results into `expo-sqlite`. A `LocalProvider` reads that
database back through the existing `MusicProvider` interface, so no screen
changes shape.

**Tech Stack:** TypeScript, `expo-file-system` (Storage Access Framework),
`expo-sqlite`, Jest (pure-node for `packages/shared`, jest-expo for the app).

## Global Constraints

- **The integrity rule — quality may be downgraded on weak evidence, never
  upgraded.** `Lossless` / `Hi-Res Lossless` may ONLY come from values read out
  of a valid `STREAMINFO` block. A `.flac` whose magic bytes are wrong, or
  whose STREAMINFO is missing/truncated, is `Unknown` — never lossless.
- A lossy extension (`.mp3`, `.aac`, `.m4a`) MAY be labeled `Lossy` from the
  extension alone; that claim is conservative and cannot oversell.
- `.wav` and `.alac` have no parser in this slice, so they are `Unknown`, not
  lossless — no parser means no evidence.
- Nothing claims "bit-perfect" anywhere. There is still no real audio pipeline.
- **Never read a whole audio file into memory.** Header parsing reads at most
  the first 65536 bytes of any file.
- Unparseable files are still imported and labeled honestly; nothing is
  silently dropped from a scan.
- No new screens. The one new UI affordance is a scan entry point in Settings.
- The FLAC parser stays pure: `Uint8Array` in, plain objects out. No file I/O,
  no React, no platform APIs — so it stays testable in plain Node.

---

## File Structure

```
packages/shared/
├── package.json                    (+ jest, babel for pure-node tests)
├── babel.config.js                 (new)
├── jest.config.js                  (new)
└── src/
    ├── index.ts                    (modify: export flac + quality APIs)
    └── flac/
        ├── utf8.ts                 (new: minimal UTF-8 decoder)
        ├── parser.ts               (new: parseFlacMetadata)
        ├── parser.test.ts          (new)
        ├── testFixtures.ts         (new: byte-array builders for tests)
        ├── quality.ts              (new: describeAudioFile — integrity rule)
        └── quality.test.ts         (new)

apps/mobile/src/
├── library/
│   ├── database.ts                 (new: expo-sqlite schema + queries)
│   ├── scanner.ts                  (new: SAF folder walk + import)
│   └── localProvider.ts            (new: MusicProvider over SQLite)
├── providers/index.ts              (modify: serve LocalProvider)
├── store/libraryStore.ts           (modify: favorites persist to SQLite)
├── components/TrackRow.tsx         (modify: render unknown duration as --:--)
└── screens/SettingsScreen.tsx      (modify: add Library > Scan Music Folder)
```

---

### Task 1: Pure-node test setup for `packages/shared`

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/babel.config.js`
- Create: `packages/shared/jest.config.js`

**Interfaces:**
- Produces: a working `pnpm --filter @aura/shared test` running plain-node Jest
  over TypeScript, used by every later task in this package.

- [ ] **Step 1: Create `packages/shared/babel.config.js`**

```javascript
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
};
```

- [ ] **Step 2: Create `packages/shared/jest.config.js`**

```javascript
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
};
```

- [ ] **Step 3: Add the test script and devDependencies to `packages/shared/package.json`**

Add a `"scripts"` block and a `"devDependencies"` block so the file reads:

```json
{
  "name": "@aura/shared",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "jest"
  },
  "dependencies": {
    "@aura/types": "workspace:*"
  },
  "devDependencies": {
    "@babel/preset-env": "^7.24.0",
    "@babel/preset-typescript": "^7.24.0",
    "@types/jest": "^29.5.12",
    "babel-jest": "^29.7.0",
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: completes without error.

- [ ] **Step 5: Verify the runner starts**

Run: `pnpm --filter @aura/shared test --passWithNoTests`
Expected: PASS — "No tests found, exiting with code 0".

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "chore(shared): add pure-node jest setup"
```

---

### Task 2: UTF-8 decoder and FLAC test fixtures

**Files:**
- Create: `packages/shared/src/flac/utf8.ts`
- Create: `packages/shared/src/flac/testFixtures.ts`

**Interfaces:**
- Produces: `decodeUtf8(bytes: Uint8Array): string`, used by the Vorbis comment
  parser in Task 4. And `buildFlacFile(...)` / `buildStreamInfoBlock(...)` /
  `buildVorbisCommentBlock(...)`, used by the tests in Tasks 3, 4 and 5.

We hand-roll UTF-8 decoding rather than using `TextDecoder`, which is not
reliably present across React Native's Hermes runtime.

- [ ] **Step 1: Write `packages/shared/src/flac/utf8.ts`**

```typescript
export function decodeUtf8(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else {
      const b1 = bytes[i++] & 0x3f;
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      const cp = ((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3 - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

export function encodeUtf8(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    if (cp > 0xffff) i++;
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }
  return new Uint8Array(out);
}
```

- [ ] **Step 2: Write `packages/shared/src/flac/testFixtures.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/flac
git commit -m "feat(shared): add utf8 codec and FLAC test fixture builders"
```

---

### Task 3: STREAMINFO parsing (TDD)

**Files:**
- Create: `packages/shared/src/flac/parser.ts`
- Test: `packages/shared/src/flac/parser.test.ts`

**Interfaces:**
- Consumes: `buildFlacFile`, `buildStreamInfoData` (Task 2).
- Produces: `parseFlacMetadata(bytes: Uint8Array): FlacMetadata | null`, plus
  the exported types `FlacStreamInfo`, `FlacTags`, `FlacMetadata`. Consumed by
  `quality.ts` (Task 5) and the scanner (Task 7). In this task
  `FlacMetadata.tags` is always `{}`; Task 4 fills it in.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/flac/parser.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test parser`
Expected: FAIL — cannot find module `./parser`.

- [ ] **Step 3: Write `packages/shared/src/flac/parser.ts`**

```typescript
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test parser`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/flac/parser.ts packages/shared/src/flac/parser.test.ts
git commit -m "feat(shared): parse FLAC STREAMINFO from raw bytes"
```

---

### Task 4: Vorbis comment (tag) parsing (TDD)

**Files:**
- Modify: `packages/shared/src/flac/parser.ts`
- Modify: `packages/shared/src/flac/parser.test.ts`

**Interfaces:**
- Consumes: `decodeUtf8` (Task 2), `buildVorbisCommentData` (Task 2).
- Produces: populated `FlacMetadata.tags` — `title`, `artist`, `album`,
  `albumArtist`, `trackNumber`, `date`. Consumed by the scanner (Task 7).

- [ ] **Step 1: Add the failing tests to `parser.test.ts`**

Append this block, and extend the existing import to
`import { buildFlacFile, buildStreamInfoData, buildVorbisCommentData } from "./testFixtures";`

```typescript
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
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm --filter @aura/shared test parser`
Expected: FAIL — tags come back `{}` where values are expected.

- [ ] **Step 3: Add Vorbis parsing to `parser.ts`**

Add the import at the top of the file:

```typescript
import { decodeUtf8 } from "./utf8";
```

Add next to the other block constant:

```typescript
const BLOCK_VORBIS_COMMENT = 4;
```

Add these functions above `parseFlacMetadata`:

```typescript
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
```

Then in `parseFlacMetadata`, declare tags alongside stream info:

```typescript
  let tags: FlacTags = {};
```

add the branch inside the block loop, right after the STREAMINFO branch:

```typescript
    } else if (type === BLOCK_VORBIS_COMMENT) {
      tags = parseVorbisComment(bytes.subarray(dataStart, dataEnd));
    }
```

and return them:

```typescript
  return { streamInfo, tags };
```

- [ ] **Step 4: Run to verify all parser tests pass**

Run: `pnpm --filter @aura/shared test parser`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/flac/parser.ts packages/shared/src/flac/parser.test.ts
git commit -m "feat(shared): parse FLAC Vorbis comment tags"
```

---

### Task 5: The integrity rule — `describeAudioFile` (TDD)

**Files:**
- Create: `packages/shared/src/flac/quality.ts`
- Test: `packages/shared/src/flac/quality.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `parseFlacMetadata`, `FlacTags` (Tasks 3-4); `AudioQualityInfo`
  from `@aura/types`.
- Produces: `describeAudioFile(fileName: string, headerBytes: Uint8Array | null):
  { quality: AudioQualityInfo; tags: FlacTags }`, consumed by the scanner
  (Task 7). Re-exported from `@aura/shared`.

This function is where the Global Constraints' integrity rule is enforced, so
its tests are the most important in the slice.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/flac/quality.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @aura/shared test quality`
Expected: FAIL — cannot find module `./quality`.

- [ ] **Step 3: Write `packages/shared/src/flac/quality.ts`**

Note `getQualityLabel` is moved here from the mobile app so the rule lives in
one place next to the parser; Task 6 updates the app to import it from here.

```typescript
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @aura/shared test quality`
Expected: PASS (9 tests).

- [ ] **Step 5: Export the new API from `packages/shared/src/index.ts`**

```typescript
export type { MusicProvider } from "./provider";
export { MockProvider } from "./mockProvider";
export { artists, albums, tracks, playlists } from "./fixtures";
export { parseFlacMetadata } from "./flac/parser";
export type { FlacMetadata, FlacStreamInfo, FlacTags } from "./flac/parser";
export { describeAudioFile, getQualityLabel } from "./flac/quality";
```

- [ ] **Step 6: Run the whole shared suite**

Run: `pnpm --filter @aura/shared test`
Expected: PASS (22 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): enforce the quality integrity rule in describeAudioFile"
```

---

### Task 6: Point the app's QualityBadge at the shared rule

**Files:**
- Modify: `apps/mobile/src/components/QualityBadge.tsx`
- Modify: `apps/mobile/src/components/QualityBadge.test.tsx`
- Modify: `apps/mobile/src/components/TrackRow.tsx`

**Interfaces:**
- Consumes: `getQualityLabel` from `@aura/shared` (Task 5).
- Produces: `QualityBadge` unchanged in props and rendering; `getQualityLabel`
  is no longer defined in the app and is re-exported from the component module
  so existing importers (`TrackRow`) keep working.

There must be exactly one implementation of the labeling rule. The app's local
copy is deleted in favour of the shared one.

- [ ] **Step 1: Replace the local rule in `QualityBadge.tsx`**

Delete the `LOSSLESS_FORMATS` constant and the local `getQualityLabel`
function, and replace the imports at the top of the file with:

```typescript
import { View, Text, StyleSheet } from "react-native";
import type { AudioQualityInfo, QualityLabel } from "@aura/types";
import { getQualityLabel } from "@aura/shared";
import { colors, spacing, radii, typography } from "../theme/tokens";

export { getQualityLabel };
```

The rest of the file (`formatDetail`, `labelColor`, `QualityBadge`, `styles`)
is unchanged.

- [ ] **Step 2: Render unknown durations honestly in `TrackRow.tsx`**

Replace the `formatDuration` function with:

```typescript
function formatDuration(sec: number): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
```

- [ ] **Step 3: Add an unknown-duration case to `QualityBadge.test.tsx`**

Append inside the existing `describe("QualityBadge", ...)` block:

```typescript
  it("renders an Unknown badge for unparseable audio", () => {
    render(<QualityBadge quality={{ format: "UNKNOWN", durationSec: 0 }} />);
    expect(screen.getByText("Unknown")).toBeTruthy();
  });
```

- [ ] **Step 4: Run the mobile suite**

Run: `pnpm --filter @aura/mobile test`
Expected: PASS — 10 tests (the 9 from Phase 1 plus the new one).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components
git commit -m "refactor(mobile): use the shared quality rule, show unknown durations as --:--"
```

---

### Task 7: SQLite library database

**Files:**
- Create: `apps/mobile/src/library/database.ts`
- Modify: `apps/mobile/package.json` (add `expo-sqlite`)

**Interfaces:**
- Consumes: `Track`, `Album`, `Artist` from `@aura/types`.
- Produces: `openLibrary(): Promise<LibraryDb>` where `LibraryDb` exposes
  `upsertScannedTrack(input: ScannedTrack): Promise<void>`,
  `getAllTracks(): Promise<Track[]>`, `getAlbums(): Promise<Album[]>`,
  `getArtists(): Promise<Artist[]>`, `searchTracks(q: string): Promise<Track[]>`,
  `setFavorite(trackId, isFavorite): Promise<void>`,
  `getFavoriteIds(): Promise<string[]>`, `clearLibrary(): Promise<void>`.
  Consumed by the scanner (Task 8) and `LocalProvider` (Task 9).

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @aura/mobile add expo-sqlite@~14.0.6`
Expected: installs without error.

- [ ] **Step 2: Write `apps/mobile/src/library/database.ts`**

```typescript
import * as SQLite from "expo-sqlite";
import type { Album, Artist, AudioQualityInfo, Track } from "@aura/types";

export interface ScannedTrack {
  id: string;
  uri: string;
  title: string;
  artistName: string;
  albumTitle: string;
  trackNumber?: number;
  quality: AudioQualityInfo;
}

export interface LibraryDb {
  upsertScannedTrack(input: ScannedTrack): Promise<void>;
  getAllTracks(): Promise<Track[]>;
  getAlbums(): Promise<Album[]>;
  getArtists(): Promise<Artist[]>;
  searchTracks(query: string): Promise<Track[]>;
  setFavorite(trackId: string, isFavorite: boolean): Promise<void>;
  getFavoriteIds(): Promise<string[]>;
  clearLibrary(): Promise<void>;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS artists (
  id   TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS albums (
  id        TEXT PRIMARY KEY NOT NULL,
  title     TEXT NOT NULL,
  artist_id TEXT NOT NULL REFERENCES artists(id),
  UNIQUE (title, artist_id)
);

CREATE TABLE IF NOT EXISTS tracks (
  id             TEXT PRIMARY KEY NOT NULL,
  uri            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  artist_id      TEXT NOT NULL REFERENCES artists(id),
  album_id       TEXT NOT NULL REFERENCES albums(id),
  track_number   INTEGER,
  format         TEXT NOT NULL,
  bit_depth      INTEGER,
  sample_rate_hz INTEGER,
  channels       INTEGER,
  bitrate_kbps   INTEGER,
  duration_sec   REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  track_id TEXT PRIMARY KEY NOT NULL REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlists (
  id    TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_album  ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title  ON tracks(title);
`;

interface TrackRow {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_title: string;
  format: string;
  bit_depth: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  bitrate_kbps: number | null;
  duration_sec: number;
}

function rowToTrack(row: TrackRow): Track {
  const quality: AudioQualityInfo = {
    format: row.format as AudioQualityInfo["format"],
    durationSec: row.duration_sec,
  };
  if (row.bit_depth !== null) quality.bitDepth = row.bit_depth;
  if (row.sample_rate_hz !== null) quality.sampleRateHz = row.sample_rate_hz;
  if (row.channels !== null) quality.channels = row.channels;
  if (row.bitrate_kbps !== null) quality.bitrateKbps = row.bitrate_kbps;

  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    albumId: row.album_id,
    albumTitle: row.album_title,
    quality,
  };
}

const TRACK_SELECT = `
SELECT tracks.id, tracks.title, tracks.artist_id, tracks.album_id,
       tracks.format, tracks.bit_depth, tracks.sample_rate_hz,
       tracks.channels, tracks.bitrate_kbps, tracks.duration_sec,
       artists.name  AS artist_name,
       albums.title  AS album_title
FROM tracks
JOIN artists ON artists.id = tracks.artist_id
JOIN albums  ON albums.id  = tracks.album_id
`;

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function openLibrary(): Promise<LibraryDb> {
  const db = await SQLite.openDatabaseAsync("aura-library.db");
  await db.execAsync(SCHEMA);

  return {
    async upsertScannedTrack(input) {
      const artistId = `artist-${slug(input.artistName)}`;
      const albumId = `album-${slug(input.albumTitle)}-${slug(input.artistName)}`;

      await db.runAsync(
        "INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)",
        artistId,
        input.artistName
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO albums (id, title, artist_id) VALUES (?, ?, ?)",
        albumId,
        input.albumTitle,
        artistId
      );
      await db.runAsync(
        `INSERT INTO tracks
           (id, uri, title, artist_id, album_id, track_number,
            format, bit_depth, sample_rate_hz, channels, bitrate_kbps, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(uri) DO UPDATE SET
           title = excluded.title,
           artist_id = excluded.artist_id,
           album_id = excluded.album_id,
           track_number = excluded.track_number,
           format = excluded.format,
           bit_depth = excluded.bit_depth,
           sample_rate_hz = excluded.sample_rate_hz,
           channels = excluded.channels,
           bitrate_kbps = excluded.bitrate_kbps,
           duration_sec = excluded.duration_sec`,
        input.id,
        input.uri,
        input.title,
        artistId,
        albumId,
        input.trackNumber ?? null,
        input.quality.format,
        input.quality.bitDepth ?? null,
        input.quality.sampleRateHz ?? null,
        input.quality.channels ?? null,
        input.quality.bitrateKbps ?? null,
        input.quality.durationSec
      );
    },

    async getAllTracks() {
      const rows = await db.getAllAsync<TrackRow>(
        `${TRACK_SELECT} ORDER BY albums.title, tracks.track_number, tracks.title`
      );
      return rows.map(rowToTrack);
    },

    async getAlbums() {
      const rows = await db.getAllAsync<{
        id: string;
        title: string;
        artist_id: string;
        artist_name: string;
      }>(
        `SELECT albums.id, albums.title, albums.artist_id, artists.name AS artist_name
         FROM albums JOIN artists ON artists.id = albums.artist_id
         ORDER BY albums.title`
      );
      const albums: Album[] = [];
      for (const row of rows) {
        const trackIds = await db.getAllAsync<{ id: string }>(
          "SELECT id FROM tracks WHERE album_id = ? ORDER BY track_number, title",
          row.id
        );
        albums.push({
          id: row.id,
          title: row.title,
          artistId: row.artist_id,
          artistName: row.artist_name,
          trackIds: trackIds.map((t) => t.id),
        });
      }
      return albums;
    },

    async getArtists() {
      const rows = await db.getAllAsync<{ id: string; name: string }>(
        "SELECT id, name FROM artists ORDER BY name"
      );
      return rows.map((row): Artist => ({ id: row.id, name: row.name }));
    },

    async searchTracks(query) {
      const rows = await db.getAllAsync<TrackRow>(
        `${TRACK_SELECT} WHERE tracks.title LIKE ? OR artists.name LIKE ? OR albums.title LIKE ?
         ORDER BY tracks.title LIMIT 100`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`
      );
      return rows.map(rowToTrack);
    },

    async setFavorite(trackId, isFavorite) {
      if (isFavorite) {
        await db.runAsync(
          "INSERT OR IGNORE INTO favorites (track_id) VALUES (?)",
          trackId
        );
      } else {
        await db.runAsync("DELETE FROM favorites WHERE track_id = ?", trackId);
      }
    },

    async getFavoriteIds() {
      const rows = await db.getAllAsync<{ track_id: string }>(
        "SELECT track_id FROM favorites"
      );
      return rows.map((row) => row.track_id);
    },

    async clearLibrary() {
      await db.execAsync(
        "DELETE FROM playlist_tracks; DELETE FROM favorites; DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;"
      );
    },
  };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/library/database.ts apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add SQLite library schema and queries"
```

---

### Task 8: Folder scanner

**Files:**
- Create: `apps/mobile/src/library/scanner.ts`

**Interfaces:**
- Consumes: `describeAudioFile` from `@aura/shared` (Task 5); `openLibrary`,
  `ScannedTrack` (Task 7).
- Produces: `scanMusicFolder(db: LibraryDb): Promise<ScanResult>` where
  `ScanResult` is `{ imported: number; unreadable: number; cancelled: boolean }`.
  Consumed by `SettingsScreen` (Task 10).

- [ ] **Step 1: Write `apps/mobile/src/library/scanner.ts`**

```typescript
import * as FileSystem from "expo-file-system";
import { describeAudioFile } from "@aura/shared";
import type { LibraryDb } from "./database";

/** Header bytes read per file. Whole audio files are never loaded. */
const HEADER_BYTES = 65536;

const AUDIO_EXTENSIONS = ["flac", "mp3", "aac", "m4a", "wav", "alac"];

export interface ScanResult {
  imported: number;
  unreadable: number;
  cancelled: boolean;
}

function fileNameFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const parts = decoded.split(/[/%:]/);
  return parts[parts.length - 1] || decoded;
}

function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return AUDIO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

function base64ToBytes(base64: string): Uint8Array {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/=+$/, "");
  const out = new Uint8Array((clean.length * 3) >> 2);
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const value = chars.indexOf(clean[i]);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, outIndex);
}

async function readHeader(uri: string): Promise<Uint8Array | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: HEADER_BYTES,
    });
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

export async function scanMusicFolder(db: LibraryDb): Promise<ScanResult> {
  const permission =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permission.granted) {
    return { imported: 0, unreadable: 0, cancelled: true };
  }

  const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(
    permission.directoryUri
  );

  let imported = 0;
  let unreadable = 0;

  for (const uri of entries) {
    const name = fileNameFromUri(uri);
    if (!isAudioFile(name)) continue;

    const header = await readHeader(uri);
    if (!header) unreadable += 1;

    const { quality, tags } = describeAudioFile(name, header);
    if (quality.format === "UNKNOWN") unreadable += header ? 1 : 0;

    await db.upsertScannedTrack({
      id: `track-${uri}`,
      uri,
      title: tags.title ?? name.replace(/\.[^.]+$/, ""),
      artistName: tags.artist ?? "Unknown Artist",
      albumTitle: tags.album ?? "Unknown Album",
      trackNumber: tags.trackNumber,
      quality,
    });
    imported += 1;
  }

  return { imported, unreadable, cancelled: false };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/library/scanner.ts
git commit -m "feat(mobile): scan an SAF folder, reading only file headers"
```

---

### Task 9: `LocalProvider`

**Files:**
- Create: `apps/mobile/src/library/localProvider.ts`
- Modify: `apps/mobile/src/providers/index.ts`

**Interfaces:**
- Consumes: `LibraryDb` (Task 7); `MusicProvider` from `@aura/shared`.
- Produces: `createLocalProvider(db: LibraryDb): MusicProvider`, and
  `getProvider(): Promise<MusicProvider>` from `providers/index.ts`, consumed by
  every screen.

- [ ] **Step 1: Write `apps/mobile/src/library/localProvider.ts`**

```typescript
import type { MusicProvider } from "@aura/shared";
import type {
  Album,
  Artist,
  PlaybackSource,
  Playlist,
  RecommendationSeed,
  SearchResults,
  Track,
} from "@aura/types";
import type { LibraryDb } from "./database";

export function createLocalProvider(db: LibraryDb): MusicProvider {
  async function requireTrack(id: string): Promise<Track> {
    const tracks = await db.getAllTracks();
    const found = tracks.find((track) => track.id === id);
    if (!found) throw new Error(`Track not found: ${id}`);
    return found;
  }

  return {
    id: "local",

    async search(query: string): Promise<SearchResults> {
      const trimmed = query.trim();
      if (!trimmed) {
        return { tracks: [], albums: [], artists: [], playlists: [] };
      }
      const needle = trimmed.toLowerCase();
      const [tracks, albums, artists] = await Promise.all([
        db.searchTracks(trimmed),
        db.getAlbums(),
        db.getArtists(),
      ]);
      return {
        tracks,
        albums: albums.filter((a) => a.title.toLowerCase().includes(needle)),
        artists: artists.filter((a) => a.name.toLowerCase().includes(needle)),
        playlists: [],
      };
    },

    async getArtist(id: string): Promise<Artist> {
      const artists = await db.getArtists();
      const found = artists.find((artist) => artist.id === id);
      if (!found) throw new Error(`Artist not found: ${id}`);
      return found;
    },

    async getAlbum(id: string): Promise<Album> {
      const albums = await db.getAlbums();
      const found = albums.find((album) => album.id === id);
      if (!found) throw new Error(`Album not found: ${id}`);
      return found;
    },

    getTrack: requireTrack,

    async getPlaylist(id: string): Promise<Playlist> {
      throw new Error(`Playlist not found: ${id}`);
    },

    async getRecommendations(seed?: RecommendationSeed): Promise<Track[]> {
      const tracks = await db.getAllTracks();
      if (!seed?.artistIds?.length) return tracks.slice(0, 10);
      const wanted = new Set(seed.artistIds);
      return tracks.filter((track) => wanted.has(track.artistId));
    },

    async getPlaybackSource(trackId: string): Promise<PlaybackSource> {
      const track = await requireTrack(trackId);
      return { trackId, uri: track.id.replace(/^track-/, ""), quality: track.quality };
    },
  };
}
```

- [ ] **Step 2: Replace `apps/mobile/src/providers/index.ts`**

```typescript
import type { MusicProvider } from "@aura/shared";
import { openLibrary, type LibraryDb } from "../library/database";
import { createLocalProvider } from "../library/localProvider";

let dbPromise: Promise<LibraryDb> | null = null;
let providerPromise: Promise<MusicProvider> | null = null;

export function getLibraryDb(): Promise<LibraryDb> {
  if (!dbPromise) dbPromise = openLibrary();
  return dbPromise;
}

export function getProvider(): Promise<MusicProvider> {
  if (!providerPromise) {
    providerPromise = getLibraryDb().then(createLocalProvider);
  }
  return providerPromise;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: errors only in screens still importing the removed `provider`
constant — Task 10 fixes those.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/library/localProvider.ts apps/mobile/src/providers/index.ts
git commit -m "feat(mobile): serve the library through a SQLite-backed LocalProvider"
```

---

### Task 10: Wire the screens to the real library

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/SearchScreen.tsx`
- Modify: `apps/mobile/src/screens/LibraryScreen.tsx`
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx`
- Modify: `apps/mobile/src/store/libraryStore.ts`
- Create: `apps/mobile/src/hooks/useLibraryData.ts`

**Interfaces:**
- Consumes: `getProvider`, `getLibraryDb` (Task 9); `scanMusicFolder` (Task 8).
- Produces: `useLibraryData()` returning
  `{ tracks: Track[]; albums: Album[]; loading: boolean; reload: () => void }`,
  used by Home and Library.

- [ ] **Step 1: Create `apps/mobile/src/hooks/useLibraryData.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import type { Album, Track } from "@aura/types";
import { getLibraryDb } from "../providers";

export function useLibraryData() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    void getLibraryDb()
      .then(async (db) => {
        const [nextTracks, nextAlbums] = await Promise.all([
          db.getAllTracks(),
          db.getAlbums(),
        ]);
        setTracks(nextTracks);
        setAlbums(nextAlbums);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  return { tracks, albums, loading, reload };
}
```

- [ ] **Step 2: Rewrite `HomeScreen.tsx` to use it**

Replace the imports of `provider`, `albums` and `tracks` from `@aura/shared`
with `import { useLibraryData } from "../hooks/useLibraryData";`, drop the
`useEffect`/`useState` that loaded fixtures, and replace the `Section`
component and `HomeScreen` body with:

```tsx
function Section({
  title,
  albums: sectionAlbums,
  tracks,
}: {
  title: string;
  albums: Album[];
  tracks: Track[];
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  if (sectionAlbums.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[typography.heading, styles.sectionTitle]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sectionAlbums.map((album) => (
          <ArtworkCard
            key={album.id}
            title={album.title}
            subtitle={album.artistName}
            onPress={() => {
              const albumTracks = tracks.filter((t) => t.albumId === album.id);
              if (albumTracks.length > 0) playTrack(albumTracks[0], albumTracks);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function HomeScreen() {
  const { tracks, albums, loading } = useLibraryData();

  const hiRes = albums.filter((album) =>
    tracks.some(
      (t) =>
        t.albumId === album.id &&
        (t.quality.bitDepth ?? 0) > 16 &&
        t.quality.format === "FLAC"
    )
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.title, styles.greeting]}>{greeting()}</Text>
      {!loading && albums.length === 0 ? (
        <Text style={[typography.caption, styles.greeting]}>
          Your library is empty. Add music from Settings › Scan Music Folder.
        </Text>
      ) : null}
      <Section title="Recently Added" albums={[...albums].reverse()} tracks={tracks} />
      <Section title="Hi-Res Collection" albums={hiRes} tracks={tracks} />
      <Section title="Your Heavy Rotation" albums={albums} tracks={tracks} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Update `SearchScreen.tsx`**

Replace `import { provider } from "../providers";` with
`import { getProvider } from "../providers";` and replace the body of
`handleChange` with:

```typescript
  function handleChange(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setResults(EMPTY_RESULTS);
      return;
    }
    void getProvider()
      .then((provider) => provider.search(text))
      .then(setResults);
  }
```

- [ ] **Step 4: Update `LibraryScreen.tsx`**

Replace `import { tracks } from "@aura/shared";` with
`import { useLibraryData } from "../hooks/useLibraryData";`, and at the top of
the component replace the fixture reference with:

```typescript
  const { tracks } = useLibraryData();
```

The rest of the component is unchanged.

- [ ] **Step 5: Persist favorites in `store/libraryStore.ts`**

```typescript
import { create } from "zustand";
import { getLibraryDb } from "../providers";

interface LibraryState {
  favoriteTrackIds: Set<string>;
  hydrate: () => void;
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favoriteTrackIds: new Set(),

  hydrate: () => {
    void getLibraryDb()
      .then((db) => db.getFavoriteIds())
      .then((ids) => set({ favoriteTrackIds: new Set(ids) }));
  },

  toggleFavorite: (trackId) => {
    const next = new Set(get().favoriteTrackIds);
    const isFavorite = !next.has(trackId);
    if (isFavorite) next.add(trackId);
    else next.delete(trackId);
    set({ favoriteTrackIds: next });
    void getLibraryDb().then((db) => db.setFavorite(trackId, isFavorite));
  },

  isFavorite: (trackId) => get().favoriteTrackIds.has(trackId),
}));
```

- [ ] **Step 6: Add the scan entry point to `SettingsScreen.tsx`**

Add these imports:

```typescript
import { Pressable, Alert } from "react-native";
import { scanMusicFolder } from "../library/scanner";
import { getLibraryDb } from "../providers";
import { useLibraryStore } from "../store/libraryStore";
```

Add this inside the component, before the `return`:

```typescript
  const [scanning, setScanning] = useState(false);
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);

  async function handleScan() {
    setScanning(true);
    try {
      const db = await getLibraryDb();
      const result = await scanMusicFolder(db);
      if (!result.cancelled) {
        hydrateFavorites();
        Alert.alert(
          "Scan complete",
          `${result.imported} file${result.imported === 1 ? "" : "s"} imported` +
            (result.unreadable > 0
              ? `, ${result.unreadable} could not be read and are listed as Unknown quality.`
              : ".")
        );
      }
    } catch (error) {
      Alert.alert("Scan failed", "Could not read that folder. Please try again.");
    } finally {
      setScanning(false);
    }
  }
```

And render a Library group above the About group:

```tsx
      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>LIBRARY</Text>
        <Pressable style={styles.row} onPress={handleScan} disabled={scanning}>
          <Text style={typography.body}>
            {scanning ? "Scanning…" : "Scan Music Folder"}
          </Text>
        </Pressable>
      </View>
```

- [ ] **Step 7: Type-check and run all tests**

Run: `pnpm --filter @aura/mobile exec tsc --noEmit`
Expected: no output (clean).

Run: `pnpm -r test`
Expected: PASS — `@aura/shared` 22 tests, `@aura/mobile` 10 tests.

Note: `RootNavigator.test.tsx` renders screens that now hit `expo-sqlite`. If
it fails to resolve the native module under Jest, add this mock at the top of
that test file (before the `RootNavigator` import) rather than weakening the
test:

```typescript
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    runAsync: async () => {},
    getAllAsync: async () => [],
  }),
}));
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src
git commit -m "feat(mobile): serve every screen from the real local library"
```

---

### Task 11: Device verification handoff

**Files:** none (verification only)

This slice's device-dependent behaviour cannot be verified without the user's
Android hardware. Do not claim any of it works until they confirm.

- [ ] **Step 1: Confirm what IS verified**

Run: `pnpm -r test`
Record the passing counts. The parser, the integrity rule, and the labeling
logic are verified by these tests.

- [ ] **Step 2: Build a dev client for the user**

The SAF folder picker and `expo-sqlite` are native modules, so Expo Go will not
run this build. Tell the user to run:

```bash
cd apps/mobile
npx expo run:android
```

- [ ] **Step 3: Give the user this checklist to confirm on device**

  - Settings › Scan Music Folder opens the Android folder picker
  - Granting a folder containing FLAC files reports a non-zero import count
  - Home shows real album names from the scanned files
  - Library lists the scanned tracks with real durations
  - A known 24-bit/96kHz FLAC shows **Hi-Res Lossless · FLAC · 24-bit / 96 kHz**
  - A known 16-bit/44.1kHz FLAC shows **Lossless**, not Hi-Res
  - An MP3 in the same folder shows **Lossy**
  - Favoriting a track, force-quitting, and reopening keeps the favorite

- [ ] **Step 4: Report honestly**

State plainly which items are verified by tests and which await the user's
device confirmation. Do not describe unverified device behaviour as working.

---

## Self-Review Notes

- **Spec coverage:** pure FLAC parser ✓ (Tasks 2-4), integrity rule with the
  adversarial mislabeled-`.flac` test ✓ (Task 5), single source of truth for
  labeling ✓ (Task 6), SQLite schema incl. deferred playlist tables ✓ (Task 7),
  SAF folder scan reading only 64KB headers ✓ (Task 8), import-everything-label-
  honestly ✓ (Task 8), `LocalProvider` over the unchanged `MusicProvider`
  interface ✓ (Task 9), screens served from real data + favorites persisted +
  scan entry point ✓ (Task 10), honest verification split ✓ (Task 11).
- **Placeholder scan:** no TBD/TODO; every code step carries literal code.
- **Type consistency:** `AudioQualityInfo`, `Track`, `Album`, `Artist` come from
  `@aura/types` unchanged. `FlacMetadata`/`FlacTags`/`FlacStreamInfo` are
  defined once in Task 3 and imported thereafter. `LibraryDb` is defined in
  Task 7 and consumed by Tasks 8-10 under that exact name. `describeAudioFile`
  and `getQualityLabel` are defined in Task 5 and imported everywhere else.
- **Known deviation from Phase 1:** `getQualityLabel` moves out of
  `QualityBadge.tsx` into `packages/shared`. Task 6 re-exports it from the
  component so `TrackRow`'s existing import keeps working.
