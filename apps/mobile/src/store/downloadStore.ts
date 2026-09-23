import { create } from "zustand";
import * as FileSystem from "expo-file-system";
import type { Track } from "@aura/types";
import { getLibraryDb, getProvider } from "../providers";

export interface DownloadItem {
  trackId: string;
  localUri: string;
  downloadedAt: number;
  fileSizeBytes: number;
}

interface DownloadState {
  downloadedTracks: Map<string, DownloadItem>;
  progress: Record<string, number>; // trackId -> 0..100
  downloadTrack: (track: Track) => Promise<void>;
  deleteDownload: (trackId: string) => Promise<void>;
  isDownloaded: (trackId: string) => boolean;
  getDownloadProgress: (trackId: string) => number | undefined;
  hydrateDownloads: () => Promise<void>;
}

const DOWNLOAD_DIR = `${FileSystem.documentDirectory || ""}aura_downloads/`;

async function ensureDirExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloadedTracks: new Map(),
  progress: {},

  hydrateDownloads: async () => {
    try {
      const db = await getLibraryDb();
      const records = await db.getDownloadedTracks();
      const map = new Map<string, DownloadItem>();
      for (const r of records) {
        map.set(r.trackId, r);
      }
      set({ downloadedTracks: map });
    } catch {
      // Fire-and-forget safe during startup
    }
  },

  isDownloaded: (trackId: string) => {
    return get().downloadedTracks.has(trackId);
  },

  getDownloadProgress: (trackId: string) => {
    return get().progress[trackId];
  },

  downloadTrack: async (track: Track) => {
    if (get().downloadedTracks.has(track.id) || get().progress[track.id] !== undefined) {
      return;
    }

    set((s) => ({ progress: { ...s.progress, [track.id]: 0 } }));

    try {
      await ensureDirExists();
      const provider = await getProvider();
      const playbackSource = await provider.getPlaybackSource(track.id);
      const ext = playbackSource.quality?.format?.toLowerCase() || "audio";
      const sanitizedId = track.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileUri = `${DOWNLOAD_DIR}${sanitizedId}.${ext}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        playbackSource.uri,
        fileUri,
        {},
        (downloadProgress) => {
          if (downloadProgress.totalBytesExpectedToWrite > 0) {
            const pct = Math.round(
              (downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite) *
                100
            );
            set((s) => ({
              progress: { ...s.progress, [track.id]: pct },
            }));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      const localUri = result?.uri || fileUri;

      const fileInfo = await FileSystem.getInfoAsync(localUri);
      const size = (fileInfo.exists && !fileInfo.isDirectory) ? fileInfo.size || 0 : 0;

      const db = await getLibraryDb();
      await db.recordDownload(track.id, localUri, size);

      const item: DownloadItem = {
        trackId: track.id,
        localUri,
        downloadedAt: Math.floor(Date.now() / 1000),
        fileSizeBytes: size,
      };

      set((s) => {
        const nextMap = new Map(s.downloadedTracks);
        nextMap.set(track.id, item);
        const nextProgress = { ...s.progress };
        delete nextProgress[track.id];
        return { downloadedTracks: nextMap, progress: nextProgress };
      });
    } catch {
      set((s) => {
        const nextProgress = { ...s.progress };
        delete nextProgress[track.id];
        return { progress: nextProgress };
      });
    }
  },

  deleteDownload: async (trackId: string) => {
    const item = get().downloadedTracks.get(trackId);
    if (!item) return;

    try {
      await FileSystem.deleteAsync(item.localUri, { idempotent: true });
    } catch {
      // Ignored if file doesn't exist
    }

    try {
      const db = await getLibraryDb();
      await db.removeDownload(trackId);
    } catch {
      // Ignored
    }

    set((s) => {
      const nextMap = new Map(s.downloadedTracks);
      nextMap.delete(trackId);
      return { downloadedTracks: nextMap };
    });
  },
}));
