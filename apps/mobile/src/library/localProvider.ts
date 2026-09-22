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
