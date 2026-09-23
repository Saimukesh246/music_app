import { create } from "zustand";
import { getLibraryDb } from "../providers";

export interface PlaylistMeta {
  id: string;
  title: string;
}

interface PlaylistState {
  playlists: PlaylistMeta[];
  /** Load all playlists from SQLite. Call once on app start. */
  hydrate: () => void;
  /** Create a new playlist; returns the new playlist id. */
  createPlaylist: (title: string) => Promise<string>;
  /** Delete a playlist. */
  deletePlaylist: (id: string) => Promise<void>;
  /** Rename a playlist (optimistic). */
  renamePlaylist: (id: string, title: string) => Promise<void>;
  /** Add a track to a playlist (fire-and-forget DB call). */
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  /** Remove a track from a playlist (fire-and-forget DB call). */
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],

  hydrate: () => {
    void getLibraryDb()
      .then((db) => db.getPlaylists())
      .then((playlists) => set({ playlists }));
  },

  createPlaylist: async (title) => {
    const db = await getLibraryDb();
    const id = await db.createPlaylist(title);
    // Optimistic: insert sorted by title
    set((s) => {
      const next = [...s.playlists, { id, title }].sort((a, b) =>
        a.title.localeCompare(b.title)
      );
      return { playlists: next };
    });
    return id;
  },

  deletePlaylist: async (id) => {
    const db = await getLibraryDb();
    await db.deletePlaylist(id);
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
  },

  renamePlaylist: async (id, title) => {
    // Optimistic state update first
    set((s) => ({
      playlists: s.playlists
        .map((p) => (p.id === id ? { ...p, title } : p))
        .sort((a, b) => a.title.localeCompare(b.title)),
    }));
    const db = await getLibraryDb();
    await db.renamePlaylist(id, title);
  },

  addTrackToPlaylist: async (playlistId, trackId) => {
    const db = await getLibraryDb();
    await db.addTrackToPlaylist(playlistId, trackId);
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    const db = await getLibraryDb();
    await db.removeTrackFromPlaylist(playlistId, trackId);
  },
}));
