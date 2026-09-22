import { useEffect, useState } from "react";
import type { Track } from "@aura/types";
import { getLyrics, parseLrc, type LyricLine } from "@aura/shared";
import { getLibraryDb } from "../providers";

export type LyricsStatus = "loading" | "ready" | "unavailable" | "instrumental";

export interface LyricsState {
  status: LyricsStatus;
  plainLyrics?: string;
  syncedLines?: LyricLine[];
}

interface CachedOrFetchedLyrics {
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental: boolean;
}

function toState(data: CachedOrFetchedLyrics): LyricsState {
  if (data.instrumental) return { status: "instrumental" };
  return {
    status: "ready",
    plainLyrics: data.plainLyrics,
    syncedLines: data.syncedLyrics ? parseLrc(data.syncedLyrics) : undefined,
  };
}

export function useLyrics(track: Track | null): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: "loading" });

  useEffect(() => {
    if (!track) {
      setState({ status: "unavailable" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      const db = await getLibraryDb();
      const cached = await db.getCachedLyrics(track.id);
      if (cached) {
        if (!cancelled) setState(toState(cached));
        return;
      }

      const result = await getLyrics(fetch, {
        trackName: track.title,
        artistName: track.artistName,
        albumName: track.albumTitle,
        durationSec: track.quality.durationSec,
      });

      if (cancelled) return;

      if (!result) {
        setState({ status: "unavailable" });
        return;
      }

      await db.cacheLyrics(track.id, result);
      if (!cancelled) setState(toState(result));
    })();

    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  return state;
}
