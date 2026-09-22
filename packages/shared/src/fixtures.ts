import type { Artist, Album, Track, Playlist } from "@aura/types";

export const artists: Artist[] = [
  { id: "artist-1", name: "Nocturne Field", genres: ["Ambient", "Electronic"] },
  { id: "artist-2", name: "Ravel Corvus", genres: ["Jazz"] },
  { id: "artist-3", name: "The Silt Choir", genres: ["Indie Rock"] },
];

export const albums: Album[] = [
  {
    id: "album-1",
    title: "Low Tide Archive",
    artistId: "artist-1",
    artistName: "Nocturne Field",
    releaseDate: "2024-03-15",
    trackIds: ["track-1", "track-2"],
  },
  {
    id: "album-2",
    title: "Brass & Static",
    artistId: "artist-2",
    artistName: "Ravel Corvus",
    releaseDate: "2023-11-01",
    trackIds: ["track-3"],
  },
  {
    id: "album-3",
    title: "Riverbed Choir",
    artistId: "artist-3",
    artistName: "The Silt Choir",
    releaseDate: "2022-06-20",
    trackIds: ["track-4", "track-5"],
  },
];

export const tracks: Track[] = [
  {
    id: "track-1",
    title: "Low Tide",
    artistId: "artist-1",
    artistName: "Nocturne Field",
    albumId: "album-1",
    albumTitle: "Low Tide Archive",
    quality: {
      format: "FLAC",
      bitDepth: 24,
      sampleRateHz: 96000,
      channels: 2,
      durationSec: 272,
    },
  },
  {
    id: "track-2",
    title: "Archive Room",
    artistId: "artist-1",
    artistName: "Nocturne Field",
    albumId: "album-1",
    albumTitle: "Low Tide Archive",
    quality: {
      format: "FLAC",
      bitDepth: 16,
      sampleRateHz: 44100,
      channels: 2,
      durationSec: 198,
    },
  },
  {
    id: "track-3",
    title: "Static Interlude",
    artistId: "artist-2",
    artistName: "Ravel Corvus",
    albumId: "album-2",
    albumTitle: "Brass & Static",
    quality: {
      format: "MP3",
      bitrateKbps: 320,
      durationSec: 214,
    },
  },
  {
    id: "track-4",
    title: "Riverbed",
    artistId: "artist-3",
    artistName: "The Silt Choir",
    albumId: "album-3",
    albumTitle: "Riverbed Choir",
    quality: {
      format: "ALAC",
      bitDepth: 24,
      sampleRateHz: 48000,
      channels: 2,
      durationSec: 301,
    },
  },
  {
    id: "track-5",
    title: "Choir of Silt",
    artistId: "artist-3",
    artistName: "The Silt Choir",
    albumId: "album-3",
    albumTitle: "Riverbed Choir",
    quality: {
      format: "AAC",
      bitrateKbps: 256,
      durationSec: 187,
    },
  },
];

export const playlists: Playlist[] = [
  {
    id: "playlist-1",
    title: "Made For You",
    trackIds: ["track-1", "track-3", "track-5"],
  },
  {
    id: "playlist-2",
    title: "Hi-Res Collection",
    trackIds: ["track-1", "track-4"],
    isSmart: true,
  },
];
