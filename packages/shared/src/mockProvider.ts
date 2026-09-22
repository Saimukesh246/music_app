import type {
  SearchResults,
  Artist,
  Album,
  Track,
  Playlist,
  RecommendationSeed,
  PlaybackSource,
} from "@aura/types";
import type { MusicProvider } from "./provider";
import { artists, albums, tracks, playlists } from "./fixtures";

function findOrThrow<T extends { id: string }>(items: T[], id: string, kind: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`${kind} not found: ${id}`);
  return found;
}

export class MockProvider implements MusicProvider {
  readonly id = "mock";

  async search(query: string): Promise<SearchResults> {
    const q = query.trim().toLowerCase();
    if (!q) return { tracks: [], albums: [], artists: [], playlists: [] };
    return {
      tracks: tracks.filter((t) => t.title.toLowerCase().includes(q)),
      albums: albums.filter((a) => a.title.toLowerCase().includes(q)),
      artists: artists.filter((a) => a.name.toLowerCase().includes(q)),
      playlists: playlists.filter((p) => p.title.toLowerCase().includes(q)),
    };
  }

  async getArtist(id: string): Promise<Artist> {
    return findOrThrow(artists, id, "Artist");
  }

  async getAlbum(id: string): Promise<Album> {
    return findOrThrow(albums, id, "Album");
  }

  async getTrack(id: string): Promise<Track> {
    return findOrThrow(tracks, id, "Track");
  }

  async getPlaylist(id: string): Promise<Playlist> {
    return findOrThrow(playlists, id, "Playlist");
  }

  async getRecommendations(seed?: RecommendationSeed): Promise<Track[]> {
    if (!seed || (!seed.artistIds?.length && !seed.trackIds?.length)) {
      return tracks.slice(0, 3);
    }
    const artistIds = new Set(seed.artistIds ?? []);
    return tracks.filter((t) => artistIds.has(t.artistId));
  }

  async getPlaybackSource(trackId: string): Promise<PlaybackSource> {
    const track = findOrThrow(tracks, trackId, "Track");
    return {
      trackId,
      uri: `mock://tracks/${trackId}`,
      quality: track.quality,
    };
  }
}
