import { create } from "zustand";

interface LibraryVersionState {
  version: number;
  bump: () => void;
}

export const useLibraryVersionStore = create<LibraryVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
