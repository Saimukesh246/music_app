import type {
  SearchResults,
  Artist,
  Album,
  Track,
  Playlist,
  RecommendationSeed,
  PlaybackSource,
  AudioQualityInfo,
  AudioFormat,
} from "@aura/types";
import type { MusicProvider } from "../provider";
import type { FetchLike } from "../metadata/musicbrainz";

const IA_BASE = "https://archive.org";

// ---------------------------------------------------------------------------
// IA API shapes (subset we actually use)
// ---------------------------------------------------------------------------

interface IASearchDoc {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  collection?: string | string[];
  subject?: string | string[];
}

interface IASearchResponse {
  response?: {
    docs?: IASearchDoc[];
    numFound?: number;
  };
}

interface IAMetadataFile {
  name?: string;
  format?: string;
  length?: string; // "mm:ss.xxx" or seconds string
  size?: string;
  bitrate?: string;
  track?: string;
}

interface IAMetadataResponse {
  metadata?: {
    identifier?: string;
    title?: string;
    creator?: string | string[];
    collection?: string | string[];
    subject?: string | string[];
    description?: string;
  };
  files?: IAMetadataFile[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstString(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function parseDurationSec(length: string | undefined): number {
  if (!length) return 0;
  // Could be "mm:ss.xxx" or a plain seconds number
  if (length.includes(":")) {
    const parts = length.split(":").map(Number);
    if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    if (parts.length === 3)
      return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  return parseFloat(length) || 0;
}

function iaFormatToAura(format: string | undefined): AudioFormat {
  if (!format) return "UNKNOWN";
  const f = format.toLowerCase();
  if (f.includes("flac")) return "FLAC";
  if (f.includes("wav")) return "WAV";
  if (f.includes("aiff") || f.includes("alac")) return "ALAC";
  if (f.includes("mp3")) return "MP3";
  if (f.includes("aac") || f.includes("m4a")) return "AAC";
  return "UNKNOWN";
}

function qualityFromFile(file: IAMetadataFile): AudioQualityInfo {
  const format = iaFormatToAura(file.format);
  const durationSec = parseDurationSec(file.length);
  const bitrateKbps = file.bitrate ? parseFloat(file.bitrate) || undefined : undefined;
  return { format, durationSec, bitrateKbps };
}

/**
 * Pick the best audio file from an IA item's file list.
 * Preference order: FLAC > WAV > MP3 > AAC > OGG/other.
 */
function pickBestAudioFile(files: IAMetadataFile[]): IAMetadataFile | null {
  const AUDIO_FORMATS = ["flac", "wav", "mp3", "aac", "ogg", "vbr mp3", "128kbps mp3"];
  const audioFiles = files.filter((f) => {
    if (!f.name || !f.format) return false;
    const fmt = f.format.toLowerCase();
    return AUDIO_FORMATS.some((af) => fmt.includes(af));
  });
  if (!audioFiles.length) return null;

  const rank = (f: IAMetadataFile): number => {
    const fmt = (f.format ?? "").toLowerCase();
    if (fmt.includes("flac")) return 0;
    if (fmt.includes("wav")) return 1;
    if (fmt.includes("mp3") || fmt.includes("vbr")) return 2;
    if (fmt.includes("aac") || fmt.includes("m4a")) return 3;
    return 4;
  };
  return audioFiles.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

function docToTrack(doc: IASearchDoc): Track {
  const id = doc.identifier ?? "";
  const artistName = firstString(doc.creator) || "Unknown Artist";
  return {
    id,
    title: doc.title ?? id,
    artistId: `ia-artist-${artistName.toLowerCase().replace(/\s+/g, "-")}`,
    artistName,
    albumId: `ia-album-${id}`,
    albumTitle: doc.title ?? id,
    artworkUrl: `${IA_BASE}/services/img/${id}`,
    quality: { format: "UNKNOWN", durationSec: 0 },
  };
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class InternetArchiveProvider implements MusicProvider {
  readonly id = "internet-archive";

  constructor(private readonly fetchFn: FetchLike) {}

  async search(query: string): Promise<SearchResults> {
    const trimmed = query.trim();
    if (!trimmed) return { tracks: [], albums: [], artists: [], playlists: [] };

    const params = new URLSearchParams({
      q: `(${trimmed}) AND mediatype:(audio)`,
      "fl[]": "identifier,title,creator,collection",
      rows: "20",
      output: "json",
    });

    let resp: Response;
    try {
      resp = await this.fetchFn(`${IA_BASE}/advancedsearch.php?${params.toString()}`);
    } catch {
      return { tracks: [], albums: [], artists: [], playlists: [] };
    }

    if (!resp.ok) return { tracks: [], albums: [], artists: [], playlists: [] };

    let body: IASearchResponse;
    try {
      body = (await resp.json()) as IASearchResponse;
    } catch {
      return { tracks: [], albums: [], artists: [], playlists: [] };
    }

    const docs = body.response?.docs ?? [];
    const tracks = docs.map(docToTrack);
    const artistNames = new Set(tracks.map((t) => t.artistName));
    const artists: Artist[] = [...artistNames].map((name) => ({
      id: `ia-artist-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
    }));

    return { tracks, albums: [], artists, playlists: [] };
  }

  async getArtist(id: string): Promise<Artist> {
    // IA doesn't have a dedicated artist endpoint; reconstruct from id convention.
    const name = id.replace(/^ia-artist-/, "").replace(/-/g, " ");
    return { id, name };
  }

  async getAlbum(id: string): Promise<Album> {
    const meta = await this._fetchMetadata(id.replace(/^ia-album-/, ""));
    const artistName = firstString(meta.metadata?.creator) || "Unknown Artist";
    return {
      id,
      title: meta.metadata?.title ?? id,
      artistId: `ia-artist-${artistName.toLowerCase().replace(/\s+/g, "-")}`,
      artistName,
      artworkUrl: `${IA_BASE}/services/img/${id}`,
      trackIds: [],
    };
  }

  async getTrack(id: string): Promise<Track> {
    const meta = await this._fetchMetadata(id);
    const artistName = firstString(meta.metadata?.creator) || "Unknown Artist";
    const bestFile = pickBestAudioFile(meta.files ?? []);
    return {
      id,
      title: meta.metadata?.title ?? id,
      artistId: `ia-artist-${artistName.toLowerCase().replace(/\s+/g, "-")}`,
      artistName,
      albumId: `ia-album-${id}`,
      albumTitle: meta.metadata?.title ?? id,
      artworkUrl: `${IA_BASE}/services/img/${id}`,
      quality: bestFile ? qualityFromFile(bestFile) : { format: "UNKNOWN", durationSec: 0 },
    };
  }

  async getPlaylist(_id: string): Promise<Playlist> {
    throw new Error("Internet Archive does not support playlists");
  }

  async getRecommendations(seed?: RecommendationSeed): Promise<Track[]> {
    // Use the seed track's collection as the search term, or fall back to
    // a generic query. Simple but honest.
    const query = seed?.genres?.[0] ?? "live music";
    const results = await this.search(query);
    const seedIds = new Set([...(seed?.trackIds ?? []), ...(seed?.artistIds ?? [])]);
    return results.tracks.filter((t) => !seedIds.has(t.id)).slice(0, 10);
  }

  async getPlaybackSource(trackId: string): Promise<PlaybackSource> {
    const meta = await this._fetchMetadata(trackId);
    const bestFile = pickBestAudioFile(meta.files ?? []);
    if (!bestFile?.name) {
      throw new Error(`No playable audio file found for Internet Archive item: ${trackId}`);
    }
    const uri = `${IA_BASE}/download/${trackId}/${bestFile.name}`;
    const quality = qualityFromFile(bestFile);
    return { trackId, uri, quality };
  }

  // ---------------------------------------------------------------------------
  private async _fetchMetadata(identifier: string): Promise<IAMetadataResponse> {
    let resp: Response;
    try {
      resp = await this.fetchFn(`${IA_BASE}/metadata/${identifier}`);
    } catch (err) {
      throw new Error(`Network error fetching Internet Archive item ${identifier}: ${String(err)}`);
    }
    if (!resp.ok) {
      throw new Error(
        `Internet Archive returned ${resp.status} for item ${identifier}`
      );
    }
    return (await resp.json()) as IAMetadataResponse;
  }
}
