import { create } from "zustand";
import { getLibraryDb } from "../providers";

interface LibraryState {
  favoriteTrackIds: Set<string>;
  hydrate: () => void;
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favoriteTrackIds: new Set(),

  hydrate: () => {
    void getLibraryDb()
      .then((db) => db.getFavoriteIds())
      .then((ids) => set({ favoriteTrackIds: new Set(ids) }));
  },

  toggleFavorite: (trackId) => {
    const next = new Set(get().favoriteTrackIds);
    const isFavorite = !next.has(trackId);
    if (isFavorite) next.add(trackId);
    else next.delete(trackId);
    set({ favoriteTrackIds: next });
    void getLibraryDb().then((db) => db.setFavorite(trackId, isFavorite));
  },

  isFavorite: (trackId) => get().favoriteTrackIds.has(trackId),
}));
