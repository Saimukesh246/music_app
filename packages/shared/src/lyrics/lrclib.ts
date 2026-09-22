import type { FetchLike } from "../metadata/musicbrainz";

export interface LyricsMatch {
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental: boolean;
}

export interface GetLyricsInput {
  trackName: string;
  artistName: string;
  albumName?: string;
  durationSec: number;
}

const USER_AGENT = "AURA/0.0.1 (personal-use FLAC player)";

interface LrclibResponse {
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export async function getLyrics(
  fetchFn: FetchLike,
  input: GetLyricsInput
): Promise<LyricsMatch | null> {
  const params = new URLSearchParams({
    track_name: input.trackName,
    artist_name: input.artistName,
    duration: String(Math.round(input.durationSec)),
  });
  if (input.albumName) params.set("album_name", input.albumName);

  const url = `https://lrclib.net/api/get?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url, { headers: { "User-Agent": USER_AGENT } });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: LrclibResponse;
  try {
    body = (await response.json()) as LrclibResponse;
  } catch {
    return null;
  }

  return {
    plainLyrics: body.plainLyrics,
    syncedLyrics: body.syncedLyrics,
    instrumental: body.instrumental ?? false,
  };
}
