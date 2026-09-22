import type { Track } from "@aura/types";

export interface RNTPTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration: number;
}

export function toRNTPTrack(track: Track, uri: string): RNTPTrack {
  return {
    id: track.id,
    url: uri,
    title: track.title,
    artist: track.artistName,
    artwork: track.artworkUrl,
    duration: track.quality.durationSec,
  };
}
