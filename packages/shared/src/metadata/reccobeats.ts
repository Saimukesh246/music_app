import type { AudioFeatures } from "@aura/types";
import type { FetchLike } from "./musicbrainz";

interface SearchResponse {
  content?: Array<{ id?: string }>;
}

export async function searchTrack(
  fetchFn: FetchLike,
  trackName: string,
  artistName: string
): Promise<string | null> {
  const params = new URLSearchParams({
    searchText: trackName,
    artist: artistName,
    size: "1",
  });
  const url = `https://api.reccobeats.com/v1/track/search?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: SearchResponse;
  try {
    body = (await response.json()) as SearchResponse;
  } catch {
    return null;
  }

  return body.content?.[0]?.id ?? null;
}

interface AudioFeaturesResponse {
  content?: Array<{
    id?: string;
    acousticness?: number;
    danceability?: number;
    energy?: number;
    instrumentalness?: number;
    valence?: number;
    tempo?: number;
  }>;
}

export async function getAudioFeatures(
  fetchFn: FetchLike,
  ids: string[]
): Promise<Map<string, AudioFeatures>> {
  const result = new Map<string, AudioFeatures>();

  const params = new URLSearchParams();
  ids.forEach((id) => params.append("ids", id));
  const url = `https://api.reccobeats.com/v1/audio-features?${params.toString()}`;

  let response;
  try {
    response = await fetchFn(url);
  } catch {
    return result;
  }

  if (!response.ok) return result;

  let body: AudioFeaturesResponse;
  try {
    body = (await response.json()) as AudioFeaturesResponse;
  } catch {
    return result;
  }

  for (const item of body.content ?? []) {
    if (!item.id) continue;
    result.set(item.id, {
      acousticness: item.acousticness ?? 0,
      danceability: item.danceability ?? 0,
      energy: item.energy ?? 0,
      instrumentalness: item.instrumentalness ?? 0,
      valence: item.valence ?? 0,
      tempo: item.tempo ?? 0,
    });
  }

  return result;
}
