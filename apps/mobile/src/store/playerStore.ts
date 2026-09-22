import { create } from "zustand";
import type { Track } from "@aura/types";

let tickHandle: ReturnType<typeof setInterval> | null = null;

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  positionSec: number;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
  seekTo: (sec: number) => void;
  stop: () => void;
}

function clearTick() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  positionSec: 0,

  playTrack: (track, queue) => {
    clearTick();
    set({
      currentTrack: track,
      queue: queue ?? get().queue,
      isPlaying: true,
      positionSec: 0,
    });
    tickHandle = setInterval(() => {
      const { positionSec, currentTrack, isPlaying } = get();
      if (!isPlaying || !currentTrack) return;
      if (positionSec + 1 >= currentTrack.quality.durationSec) {
        get().playNext();
        return;
      }
      set({ positionSec: positionSec + 1 });
    }, 1000);
  },

  togglePlayPause: () => set((s) => ({ isPlaying: !s.isPlaying })),

  playNext: () => {
    const { queue, currentTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const next = queue[idx + 1];
    if (next) get().playTrack(next, queue);
  },

  playPrevious: () => {
    const { queue, currentTrack } = get();
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prev = queue[idx - 1];
    if (prev) get().playTrack(prev, queue);
  },

  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  seekTo: (sec) => set({ positionSec: sec }),

  stop: () => {
    clearTick();
    set({ currentTrack: null, queue: [], isPlaying: false, positionSec: 0 });
  },
}));
