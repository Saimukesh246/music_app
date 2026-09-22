export type AudioFormat = "FLAC" | "ALAC" | "WAV" | "MP3" | "AAC" | "UNKNOWN";

export type QualityLabel = "Lossless" | "Hi-Res Lossless" | "Lossy" | "Unknown";

export interface AudioQualityInfo {
  format: AudioFormat;
  bitDepth?: number;      // e.g. 16, 24 — undefined for lossy formats
  sampleRateHz?: number;  // e.g. 44100, 96000 — undefined if unknown
  channels?: number;      // e.g. 2 for stereo
  bitrateKbps?: number;   // for lossy formats, or informational for lossless
  durationSec: number;
}

export interface Artist {
  id: string;
  name: string;
  artworkUrl?: string;
  genres?: string[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artworkUrl?: string;
  releaseDate?: string; // ISO date
  trackIds: string[];
}

export interface AudioFeatures {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  valence: number;
  tempo: number; // BPM
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string;
  albumTitle: string;
  artworkUrl?: string;
  quality: AudioQualityInfo;
  audioFeatures?: AudioFeatures;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artworkUrl?: string;
  trackIds: string[];
  isSmart?: boolean;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export interface RecommendationSeed {
  trackIds?: string[];
  artistIds?: string[];
  genres?: string[];
}

export interface PlaybackSource {
  trackId: string;
  uri: string;
  quality: AudioQualityInfo;
}
