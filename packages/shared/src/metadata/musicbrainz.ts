export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface MusicBrainzReleaseMatch {
  releaseMbid: string;
  artistMbid: string;
  releaseDate?: string;
}

const USER_AGENT = "AURA/0.0.1 (personal-use FLAC player)";

interface ReleaseSearchResponse {
  releases?: Array<{
    id?: string;
    date?: string;
    "artist-credit"?: Array<{ artist?: { id?: string } }>;
  }>;
}

export async function searchRelease(
  fetchFn: FetchLike,
  artist: string,
  album: string
): Promise<MusicBrainzReleaseMatch | null> {
  const query = `release:"${album}" AND artist:"${artist}"`;
  const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
    query
  )}&fmt=json&limit=1`;

  let response;
  try {
    response = await fetchFn(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: ReleaseSearchResponse;
  try {
    body = (await response.json()) as ReleaseSearchResponse;
  } catch {
    return null;
  }

  const release = body.releases?.[0];
  const artistMbid = release?.["artist-credit"]?.[0]?.artist?.id;
  if (!release?.id || !artistMbid) return null;

  return {
    releaseMbid: release.id,
    artistMbid,
    releaseDate: release.date,
  };
}
