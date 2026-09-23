import * as SQLite from "expo-sqlite";
import type { Album, Artist, AudioFeatures, AudioQualityInfo, Track } from "@aura/types";

export interface ScannedTrack {
  id: string;
  uri: string;
  title: string;
  artistName: string;
  albumTitle: string;
  trackNumber?: number;
  quality: AudioQualityInfo;
}

export interface AlbumPendingEnrichment {
  id: string;
  artistId: string;
  title: string;
  artistName: string;
}

export interface LibraryDb {
  upsertScannedTrack(input: ScannedTrack): Promise<void>;
  getAllTracks(): Promise<Track[]>;
  getAlbums(): Promise<Album[]>;
  getArtists(): Promise<Artist[]>;
  searchTracks(query: string): Promise<Track[]>;
  setFavorite(trackId: string, isFavorite: boolean): Promise<void>;
  getFavoriteIds(): Promise<string[]>;
  clearLibrary(): Promise<void>;
  getAlbumsPendingEnrichment(): Promise<AlbumPendingEnrichment[]>;
  setAlbumEnrichment(
    albumId: string,
    data: { musicbrainzId: string; releaseDate?: string; artworkUrl?: string }
  ): Promise<void>;
  setArtistMusicBrainzId(artistId: string, musicbrainzId: string): Promise<void>;
  getCachedLyrics(
    trackId: string
  ): Promise<{ plainLyrics?: string; syncedLyrics?: string; instrumental: boolean } | null>;
  cacheLyrics(
    trackId: string,
    data: { plainLyrics?: string; syncedLyrics?: string; instrumental: boolean }
  ): Promise<void>;
  getTracksPendingAudioFeatures(): Promise<
    { id: string; title: string; artistName: string }[]
  >;
  setTrackAudioFeatures(
    trackId: string,
    data: { reccobeatsId: string } & AudioFeatures
  ): Promise<void>;
  /** Record that trackId was played right now. Fire-and-forget safe. */
  recordPlay(trackId: string): Promise<void>;
  /**
   * Return a map of trackId → play count for plays that occurred at or after
   * `sinceEpoch` (Unix seconds). Tracks with zero plays are omitted.
   */
  getPlayCounts(sinceEpoch: number): Promise<Map<string, number>>;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS artists (
  id   TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS albums (
  id        TEXT PRIMARY KEY NOT NULL,
  title     TEXT NOT NULL,
  artist_id TEXT NOT NULL REFERENCES artists(id),
  UNIQUE (title, artist_id)
);

CREATE TABLE IF NOT EXISTS tracks (
  id             TEXT PRIMARY KEY NOT NULL,
  uri            TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  artist_id      TEXT NOT NULL REFERENCES artists(id),
  album_id       TEXT NOT NULL REFERENCES albums(id),
  track_number   INTEGER,
  format         TEXT NOT NULL,
  bit_depth      INTEGER,
  sample_rate_hz INTEGER,
  channels       INTEGER,
  bitrate_kbps   INTEGER,
  duration_sec   REAL NOT NULL
);


CREATE TABLE IF NOT EXISTS favorites (
  track_id TEXT PRIMARY KEY NOT NULL REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlists (
  id    TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS lyrics (
  track_id      TEXT PRIMARY KEY NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  plain_lyrics  TEXT,
  synced_lyrics TEXT,
  instrumental  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS play_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_album      ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist     ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_title      ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at);
`;

interface TrackRow {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_title: string;
  format: string;
  bit_depth: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  bitrate_kbps: number | null;
  duration_sec: number;
  acousticness: number | null;
  danceability: number | null;
  energy: number | null;
  instrumentalness: number | null;
  valence: number | null;
  tempo: number | null;
}

function rowToTrack(row: TrackRow): Track {
  const quality: AudioQualityInfo = {
    format: row.format as AudioQualityInfo["format"],
    durationSec: row.duration_sec,
  };
  if (row.bit_depth !== null) quality.bitDepth = row.bit_depth;
  if (row.sample_rate_hz !== null) quality.sampleRateHz = row.sample_rate_hz;
  if (row.channels !== null) quality.channels = row.channels;
  if (row.bitrate_kbps !== null) quality.bitrateKbps = row.bitrate_kbps;

  const track: Track = {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    albumId: row.album_id,
    albumTitle: row.album_title,
    quality,
  };

  if (
    row.acousticness !== null &&
    row.danceability !== null &&
    row.energy !== null &&
    row.instrumentalness !== null &&
    row.valence !== null &&
    row.tempo !== null
  ) {
    track.audioFeatures = {
      acousticness: row.acousticness,
      danceability: row.danceability,
      energy: row.energy,
      instrumentalness: row.instrumentalness,
      valence: row.valence,
      tempo: row.tempo,
    };
  }

  return track;
}

const TRACK_SELECT = `
SELECT tracks.id, tracks.title, tracks.artist_id, tracks.album_id,
       tracks.format, tracks.bit_depth, tracks.sample_rate_hz,
       tracks.channels, tracks.bitrate_kbps, tracks.duration_sec,
       tracks.acousticness, tracks.danceability, tracks.energy,
       tracks.instrumentalness, tracks.valence, tracks.tempo,
       artists.name  AS artist_name,
       albums.title  AS album_title
FROM tracks
JOIN artists ON artists.id = tracks.artist_id
JOIN albums  ON albums.id  = tracks.album_id
`;

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

interface MigratableDb {
  getAllAsync<T>(sql: string): Promise<T[]>;
  execAsync(sql: string): Promise<unknown>;
}

export async function ensureColumn(
  db: MigratableDb,
  table: string,
  column: string,
  ddlType: string
): Promise<void> {
  const existing = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!existing.some((col) => col.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
  }
}

export async function openLibrary(): Promise<LibraryDb> {
  const db = await SQLite.openDatabaseAsync("aura-library.db");
  await db.execAsync(SCHEMA);
  await ensureColumn(db, "albums", "musicbrainz_id", "TEXT");
  await ensureColumn(db, "albums", "release_date", "TEXT");
  await ensureColumn(db, "albums", "artwork_url", "TEXT");
  await ensureColumn(db, "artists", "musicbrainz_id", "TEXT");
  await ensureColumn(db, "tracks", "reccobeats_id", "TEXT");
  await ensureColumn(db, "tracks", "acousticness", "REAL");
  await ensureColumn(db, "tracks", "danceability", "REAL");
  await ensureColumn(db, "tracks", "energy", "REAL");
  await ensureColumn(db, "tracks", "instrumentalness", "REAL");
  await ensureColumn(db, "tracks", "valence", "REAL");
  await ensureColumn(db, "tracks", "tempo", "REAL");

  return {
    async upsertScannedTrack(input) {
      const artistId = `artist-${slug(input.artistName)}`;
      const albumId = `album-${slug(input.albumTitle)}-${slug(input.artistName)}`;

      await db.runAsync(
        "INSERT OR IGNORE INTO artists (id, name) VALUES (?, ?)",
        artistId,
        input.artistName
      );
      await db.runAsync(
        "INSERT OR IGNORE INTO albums (id, title, artist_id) VALUES (?, ?, ?)",
        albumId,
        input.albumTitle,
        artistId
      );
      await db.runAsync(
        `INSERT INTO tracks
           (id, uri, title, artist_id, album_id, track_number,
            format, bit_depth, sample_rate_hz, channels, bitrate_kbps, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(uri) DO UPDATE SET
           title = excluded.title,
           artist_id = excluded.artist_id,
           album_id = excluded.album_id,
           track_number = excluded.track_number,
           format = excluded.format,
           bit_depth = excluded.bit_depth,
           sample_rate_hz = excluded.sample_rate_hz,
           channels = excluded.channels,
           bitrate_kbps = excluded.bitrate_kbps,
           duration_sec = excluded.duration_sec`,
        input.id,
        input.uri,
        input.title,
        artistId,
        albumId,
        input.trackNumber ?? null,
        input.quality.format,
        input.quality.bitDepth ?? null,
        input.quality.sampleRateHz ?? null,
        input.quality.channels ?? null,
        input.quality.bitrateKbps ?? null,
        input.quality.durationSec
      );
    },

    async getAllTracks() {
      const rows = await db.getAllAsync<TrackRow>(
        `${TRACK_SELECT} ORDER BY albums.title, tracks.track_number, tracks.title`
      );
      return rows.map(rowToTrack);
    },

    async getAlbums() {
      const rows = await db.getAllAsync<{
        id: string;
        title: string;
        artist_id: string;
        artist_name: string;
        release_date: string | null;
        artwork_url: string | null;
      }>(
        `SELECT albums.id, albums.title, albums.artist_id, albums.release_date, albums.artwork_url,
                artists.name AS artist_name
         FROM albums JOIN artists ON artists.id = albums.artist_id
         ORDER BY albums.title`
      );
      const albums: Album[] = [];
      for (const row of rows) {
        const trackIds = await db.getAllAsync<{ id: string }>(
          "SELECT id FROM tracks WHERE album_id = ? ORDER BY track_number, title",
          row.id
        );
        const album: Album = {
          id: row.id,
          title: row.title,
          artistId: row.artist_id,
          artistName: row.artist_name,
          trackIds: trackIds.map((t) => t.id),
        };
        if (row.release_date) album.releaseDate = row.release_date;
        if (row.artwork_url) album.artworkUrl = row.artwork_url;
        albums.push(album);
      }
      return albums;
    },

    async getArtists() {
      const rows = await db.getAllAsync<{ id: string; name: string }>(
        "SELECT id, name FROM artists ORDER BY name"
      );
      return rows.map((row): Artist => ({ id: row.id, name: row.name }));
    },

    async searchTracks(query) {
      const rows = await db.getAllAsync<TrackRow>(
        `${TRACK_SELECT} WHERE tracks.title LIKE ? OR artists.name LIKE ? OR albums.title LIKE ?
         ORDER BY tracks.title LIMIT 100`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`
      );
      return rows.map(rowToTrack);
    },

    async setFavorite(trackId, isFavorite) {
      if (isFavorite) {
        await db.runAsync(
          "INSERT OR IGNORE INTO favorites (track_id) VALUES (?)",
          trackId
        );
      } else {
        await db.runAsync("DELETE FROM favorites WHERE track_id = ?", trackId);
      }
    },

    async getFavoriteIds() {
      const rows = await db.getAllAsync<{ track_id: string }>(
        "SELECT track_id FROM favorites"
      );
      return rows.map((row) => row.track_id);
    },

    async clearLibrary() {
      await db.execAsync(
        "DELETE FROM playlist_tracks; DELETE FROM favorites; DELETE FROM tracks; DELETE FROM albums; DELETE FROM artists;"
      );
    },

    async getAlbumsPendingEnrichment() {
      const rows = await db.getAllAsync<{
        id: string;
        artist_id: string;
        title: string;
        artist_name: string;
      }>(
        `SELECT albums.id, albums.artist_id, albums.title, artists.name AS artist_name
         FROM albums JOIN artists ON artists.id = albums.artist_id
         WHERE albums.musicbrainz_id IS NULL`
      );
      return rows.map(
        (row): AlbumPendingEnrichment => ({
          id: row.id,
          artistId: row.artist_id,
          title: row.title,
          artistName: row.artist_name,
        })
      );
    },

    async setAlbumEnrichment(albumId, data) {
      await db.runAsync(
        "UPDATE albums SET musicbrainz_id = ?, release_date = ?, artwork_url = ? WHERE id = ?",
        data.musicbrainzId,
        data.releaseDate ?? null,
        data.artworkUrl ?? null,
        albumId
      );
    },

    async setArtistMusicBrainzId(artistId, musicbrainzId) {
      await db.runAsync(
        "UPDATE artists SET musicbrainz_id = ? WHERE id = ?",
        musicbrainzId,
        artistId
      );
    },

    async getCachedLyrics(trackId) {
      const row = await db.getFirstAsync<{
        plain_lyrics: string | null;
        synced_lyrics: string | null;
        instrumental: number;
      }>("SELECT plain_lyrics, synced_lyrics, instrumental FROM lyrics WHERE track_id = ?", trackId);
      if (!row) return null;
      return {
        plainLyrics: row.plain_lyrics ?? undefined,
        syncedLyrics: row.synced_lyrics ?? undefined,
        instrumental: row.instrumental === 1,
      };
    },

    async cacheLyrics(trackId, data) {
      await db.runAsync(
        `INSERT INTO lyrics (track_id, plain_lyrics, synced_lyrics, instrumental)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(track_id) DO UPDATE SET
           plain_lyrics = excluded.plain_lyrics,
           synced_lyrics = excluded.synced_lyrics,
           instrumental = excluded.instrumental`,
        trackId,
        data.plainLyrics ?? null,
        data.syncedLyrics ?? null,
        data.instrumental ? 1 : 0
      );
    },

    async getTracksPendingAudioFeatures() {
      const rows = await db.getAllAsync<{ id: string; title: string; artist_name: string }>(
        `SELECT tracks.id, tracks.title, artists.name AS artist_name
         FROM tracks JOIN artists ON artists.id = tracks.artist_id
         WHERE tracks.reccobeats_id IS NULL`
      );
      return rows.map((row) => ({ id: row.id, title: row.title, artistName: row.artist_name }));
    },

    async setTrackAudioFeatures(trackId, data) {
      await db.runAsync(
        `UPDATE tracks SET
           reccobeats_id = ?, acousticness = ?, danceability = ?, energy = ?,
           instrumentalness = ?, valence = ?, tempo = ?
         WHERE id = ?`,
        data.reccobeatsId,
        data.acousticness,
        data.danceability,
        data.energy,
        data.instrumentalness,
        data.valence,
        data.tempo,
        trackId
      );
    },

    async recordPlay(trackId) {
      await db.runAsync(
        `INSERT INTO play_history (track_id) VALUES (?)`,
        trackId
      );
    },

    async getPlayCounts(sinceEpoch) {
      const rows = await db.getAllAsync<{ track_id: string; cnt: number }>(
        `SELECT track_id, COUNT(*) AS cnt
         FROM play_history
         WHERE played_at >= ?
         GROUP BY track_id`,
        sinceEpoch
      );
      const map = new Map<string, number>();
      for (const row of rows) {
        map.set(row.track_id, row.cnt);
      }
      return map;
    },
  };
}
