import type {
  Artist,
  Album,
  Track,
  Playlist,
  SearchResults,
  RecommendationSeed,
  PlaybackSource,
  AudioQualityInfo,
} from "@aura/types";
import type { MusicProvider } from "../provider";
import type { FetchLike } from "../metadata/musicbrainz";

export interface AuraCloudConfig {
  getBaseUrl: () => string;
  getToken?: () => string | null;
  fetch?: FetchLike;
}

export class AuraCloudProvider implements MusicProvider {
  readonly id = "aura-cloud";
  private readonly getBaseUrl: () => string;
  private readonly getToken?: () => string | null;
  private readonly fetchFn: FetchLike;

  constructor(config: AuraCloudConfig) {
    this.getBaseUrl = config.getBaseUrl;
    this.getToken = config.getToken;
    this.fetchFn = config.fetch ?? (fetch as unknown as FetchLike);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const token = this.getToken ? this.getToken() : null;
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  private cleanBaseUrl(): string {
    return this.getBaseUrl().replace(/\/$/, "");
  }

  private toTrack(item: any): Track {
    const duration = typeof item.duration_sec === "number" ? item.duration_sec : 0;
    const quality: AudioQualityInfo = {
      format: "FLAC",
      bitDepth: 24,
      sampleRateHz: 96000,
      channels: 2,
      durationSec: duration,
    };
    return {
      id: String(item.id),
      title: item.title,
      artistId: String(item.artist_id),
      artistName: item.artist_name || "Unknown Artist",
      albumId: String(item.album_id),
      albumTitle: item.album_title || "Unknown Album",
      artworkUrl: undefined,
      quality,
    };
  }

  private toAlbum(item: any): Album {
    return {
      id: String(item.id),
      title: item.title,
      artistId: String(item.artist_id),
      artistName: item.artist_name || "Unknown Artist",
      releaseDate: item.release_date || undefined,
      trackIds: Array.isArray(item.track_ids) ? item.track_ids.map(String) : [],
    };
  }

  private toArtist(item: any): Artist {
    return {
      id: String(item.id),
      name: item.name,
    };
  }

  private toPlaylist(item: any): Playlist {
    return {
      id: String(item.id),
      title: item.title,
      trackIds: Array.isArray(item.track_ids) ? item.track_ids.map(String) : [],
    };
  }

  async search(query: string): Promise<SearchResults> {
    const base = this.cleanBaseUrl();
    const res = await this.fetchFn(
      `${base}/search?q=${encodeURIComponent(query)}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) {
      return { tracks: [], albums: [], artists: [], playlists: [] };
    }
    const data = await res.json();
    return {
      tracks: (data.tracks || []).map((t: any) => this.toTrack(t)),
      albums: (data.albums || []).map((a: any) => this.toAlbum(a)),
      artists: (data.artists || []).map((ar: any) => this.toArtist(ar)),
      playlists: [],
    };
  }

  async getArtist(id: string): Promise<Artist> {
    const base = this.cleanBaseUrl();
    const res = await this.fetchFn(`${base}/artists/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Artist ${id} not found`);
    }
    const data = await res.json();
    return this.toArtist(data);
  }

  async getAlbum(id: string): Promise<Album> {
    const base = this.cleanBaseUrl();
    const res = await this.fetchFn(`${base}/albums/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Album ${id} not found`);
    }
    const data = await res.json();
    return this.toAlbum(data);
  }

  async getTrack(id: string): Promise<Track> {
    const base = this.cleanBaseUrl();
    const res = await this.fetchFn(`${base}/tracks/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Track ${id} not found`);
    }
    const data = await res.json();
    return this.toTrack(data);
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const base = this.cleanBaseUrl();
    const res = await this.fetchFn(`${base}/playlists/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Playlist ${id} not found`);
    }
    const data = await res.json();
    return this.toPlaylist(data);
  }

  async getRecommendations(seed?: RecommendationSeed): Promise<Track[]> {
    const base = this.cleanBaseUrl();
    let url = `${base}/recommendations`;
    if (seed?.trackIds && seed.trackIds.length > 0) {
      url += `?seed_track_id=${encodeURIComponent(seed.trackIds[0])}`;
    }
    const res = await this.fetchFn(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return (data || []).map((t: any) => this.toTrack(t));
  }

  async getPlaybackSource(trackId: string): Promise<PlaybackSource> {
    const track = await this.getTrack(trackId);
    const base = this.cleanBaseUrl();
    const token = this.getToken ? this.getToken() : null;
    const uri = `${base}/stream/${trackId}${
      token ? `?token=${encodeURIComponent(token)}` : ""
    }`;

    return {
      trackId,
      uri,
      quality: track.quality,
    };
  }
}
