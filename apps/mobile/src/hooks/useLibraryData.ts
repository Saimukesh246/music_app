import { useCallback, useEffect, useState } from "react";
import type { Album, Track } from "@aura/types";
import { getLibraryDb } from "../providers";
import { useLibraryVersionStore } from "../store/libraryVersionStore";

const THIRTY_DAYS_SECS = 30 * 24 * 60 * 60;

export interface LibraryStats {
  totalTracks: number;
  totalHours: number;
  hiRes: number;    // bit depth > 16 AND FLAC
  lossless: number; // FLAC (16-bit or unknown depth) but not hi-res
  lossy: number;    // MP3 / AAC / OGG
  unknown: number;  // UNKNOWN format
}

function computeStats(tracks: Track[]): LibraryStats {
  let totalDurationSec = 0;
  let hiRes = 0, lossless = 0, lossy = 0, unknown = 0;

  for (const t of tracks) {
    totalDurationSec += t.quality.durationSec ?? 0;
    const fmt = t.quality.format;
    const depth = t.quality.bitDepth ?? 0;
    if (fmt === "FLAC" || fmt === "WAV" || fmt === "ALAC") {
      if (depth > 16) hiRes++;
      else lossless++;
    } else if (fmt === "MP3" || fmt === "AAC" || fmt === "OGG") {
      lossy++;
    } else {
      unknown++;
    }
  }

  return {
    totalTracks: tracks.length,
    totalHours: Math.round((totalDurationSec / 3600) * 10) / 10,
    hiRes,
    lossless,
    lossy,
    unknown,
  };
}

export function useLibraryData() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [playCountsMap, setPlayCountsMap] = useState<Map<string, number>>(new Map());
  const [libStats, setLibStats] = useState<LibraryStats>({
    totalTracks: 0, totalHours: 0, hiRes: 0, lossless: 0, lossy: 0, unknown: 0,
  });
  const version = useLibraryVersionStore((s) => s.version);

  const reload = useCallback(() => {
    setLoading(true);
    const sinceEpoch = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SECS;
    void getLibraryDb()
      .then(async (db) => {
        const [nextTracks, nextAlbums, counts] = await Promise.all([
          db.getAllTracks(),
          db.getAlbums(),
          db.getPlayCounts(sinceEpoch),
        ]);
        setTracks(nextTracks);
        setAlbums(nextAlbums);
        setPlayCountsMap(counts);
        setLibStats(computeStats(nextTracks));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload, version]);

  return { tracks, albums, loading, reload, playCountsMap, libStats };
}
