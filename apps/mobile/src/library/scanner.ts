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
