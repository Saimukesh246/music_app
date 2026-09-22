import { create } from "zustand";

interface LibraryState {
  favoriteTrackIds: Set<string>;
  toggleFavorite: (trackId: string) => void;
  isFavorite: (trackId: string) => boolean;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  favoriteTrackIds: new Set(),

  toggleFavorite: (trackId) => {
    const next = new Set(get().favoriteTrackIds);
    if (next.has(trackId)) next.delete(trackId);
    else next.add(trackId);
    set({ favoriteTrackIds: next });
  },

  isFavorite: (trackId) => get().favoriteTrackIds.has(trackId),
}));
