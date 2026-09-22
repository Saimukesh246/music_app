import type {
  Artist,
  Album,
  Track,
  Playlist,
  SearchResults,
  RecommendationSeed,
  PlaybackSource,
} from "@aura/types";

export interface MusicProvider {
  readonly id: string;
  search(query: string): Promise<SearchResults>;
  getArtist(id: string): Promise<Artist>;
  getAlbum(id: string): Promise<Album>;
  getTrack(id: string): Promise<Track>;
  getPlaylist(id: string): Promise<Playlist>;
  getRecommendations(seed?: RecommendationSeed): Promise<Track[]>;
  getPlaybackSource(trackId: string): Promise<PlaybackSource>;
}
