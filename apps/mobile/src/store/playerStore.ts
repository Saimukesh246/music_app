import { create } from "zustand";
import TrackPlayer, { Event, RepeatMode, State } from "react-native-track-player";
import type { Track } from "@aura/types";
import { getProvider } from "../providers";
import { getLibraryDb } from "../providers";
import { toRNTPTrack } from "../audio/trackMapper";

export type RepeatModeSetting = "off" | "all" | "one";

const NATIVE_REPEAT_MODE: Record<RepeatModeSetting, RepeatMode> = {
  off: RepeatMode.Off,
  all: RepeatMode.Queue,
  one: RepeatMode.Track,
};

const REPEAT_CYCLE: RepeatModeSetting[] = ["off", "all", "one"];

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  positionSec: number;
  repeatMode: RepeatModeSetting;
  shuffleEnabled: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSec: number | null;
  setSleepTimer: (minutes: number | null) => void;
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => Promise<void>;
  clearUpcomingQueue: () => Promise<void>;
  seekTo: (sec: number) => void;
  stop: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
}

/**
 * RNTP events identify tracks by the id we gave them, not by the full app
 * Track object. This map is how PlaybackActiveTrackChanged gets back to a
 * real Track (with quality, album, etc.) for the store to expose.
 */
const trackById = new Map<string, Track>();

/**
 * Fisher-Yates in-place shuffle. Returns the same array.
 * Does NOT move the element at index 0 (the currently-selected track).
 */
function shuffleFromIndex1<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(Math.random() * i); // 1..i
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  TrackPlayer.addEventListener(Event.PlaybackState, (event: { state: State }) => {
    set({ isPlaying: event.state === State.Playing });
  });

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    // RNTP's own Track type doesn't declare `id`, but toRNTPTrack always
    // sets one, so every active track carries it through at runtime.
    const activeId = (event.track as { id?: string } | undefined)?.id;
    const prevTrack = get().currentTrack;
    if (get().sleepTimerMinutes === -1 && prevTrack && activeId !== prevTrack.id) {
      set({ sleepTimerMinutes: null, sleepTimerRemainingSec: null });
      void TrackPlayer.pause();
    }
    set({
      currentTrack: activeId ? trackById.get(activeId) ?? null : null,
      positionSec: 0,
    });
  });

  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    (event: { position: number }) => {
      set({ positionSec: event.position });
    }
  );

  let pausedByInterruption = false;
  let sleepTimerInterval: ReturnType<typeof setInterval> | null = null;

  TrackPlayer.addEventListener(
    Event.RemoteDuck,
    (event: { paused: boolean; permanent: boolean }) => {
      if (event.paused) {
        pausedByInterruption = !event.permanent;
      } else if (pausedByInterruption) {
        pausedByInterruption = false;
        void TrackPlayer.play();
      }
    }
  );

  return {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    positionSec: 0,
    repeatMode: "off",
    shuffleEnabled: false,
    sleepTimerMinutes: null,
    sleepTimerRemainingSec: null,

    setSleepTimer: (minutes: number | null) => {
      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
        sleepTimerInterval = null;
      }

      if (minutes === null) {
        set({ sleepTimerMinutes: null, sleepTimerRemainingSec: null });
        return;
      }

      if (minutes === -1) {
        // End of track mode
        set({ sleepTimerMinutes: -1, sleepTimerRemainingSec: null });
        return;
      }

      const totalSec = minutes * 60;
      set({ sleepTimerMinutes: minutes, sleepTimerRemainingSec: totalSec });

      sleepTimerInterval = setInterval(() => {
        const currentRemaining = get().sleepTimerRemainingSec;
        if (currentRemaining === null || currentRemaining <= 1) {
          if (sleepTimerInterval) clearInterval(sleepTimerInterval);
          sleepTimerInterval = null;
          set({ sleepTimerMinutes: null, sleepTimerRemainingSec: null });
          void TrackPlayer.pause();
        } else {
          set({ sleepTimerRemainingSec: currentRemaining - 1 });
        }
      }, 1000);
    },

    playTrack: async (track, queue) => {
      pausedByInterruption = false;
      let nextQueue = queue ? [...queue] : [...get().queue];

      // Place the selected track at position 0, then shuffle the rest.
      const targetIdx = nextQueue.findIndex((t) => t.id === track.id);
      if (targetIdx > 0) {
        [nextQueue[0], nextQueue[targetIdx]] = [nextQueue[targetIdx], nextQueue[0]];
      } else if (targetIdx < 0) {
        nextQueue = [track, ...nextQueue];
      }
      if (get().shuffleEnabled) shuffleFromIndex1(nextQueue);

      set({ queue: nextQueue });

      const provider = await getProvider();
      const db = await getLibraryDb();
      const rntpTracks = await Promise.all(
        nextQueue.map(async (queuedTrack) => {
          trackById.set(queuedTrack.id, queuedTrack);
          // Check if track is downloaded locally for instant offline playback
          let uri: string | null = null;
          try {
            uri = await db.getDownloadedTrackUri(queuedTrack.id);
          } catch {
            // Fall back to provider
          }
          if (!uri) {
            const source = await provider.getPlaybackSource(queuedTrack.id);
            uri = source.uri;
          }
          return toRNTPTrack(queuedTrack, uri);
        })
      );

      await TrackPlayer.setQueue(rntpTracks);
      await TrackPlayer.skip(0);
      await TrackPlayer.play();

      // Fire-and-forget: record the play. Never blocks playback.
      void db.recordPlay(track.id).catch(() => undefined);
    },

    togglePlayPause: async () => {
      pausedByInterruption = false;
      if (get().isPlaying) await TrackPlayer.pause();
      else await TrackPlayer.play();
    },

    playNext: async () => {
      pausedByInterruption = false;
      await TrackPlayer.skipToNext();
    },

    playPrevious: async () => {
      pausedByInterruption = false;
      await TrackPlayer.skipToPrevious();
    },

    addToQueue: async (track) => {
      set((s) => ({ queue: [...s.queue, track] }));
      trackById.set(track.id, track);
      const db = await getLibraryDb();
      let uri: string | null = null;
      try {
        uri = await db.getDownloadedTrackUri(track.id);
      } catch {
        // Fall back
      }
      if (!uri) {
        const provider = await getProvider();
        const source = await provider.getPlaybackSource(track.id);
        uri = source.uri;
      }
      await TrackPlayer.add(toRNTPTrack(track, uri));
    },

    removeFromQueue: async (index) => {
      const q = [...get().queue];
      if (index < 0 || index >= q.length) return;
      q.splice(index, 1);
      set({ queue: q });
      try {
        await TrackPlayer.remove(index);
      } catch {
        // Safe fallback
      }
    },

    clearUpcomingQueue: async () => {
      const current = get().currentTrack;
      if (!current) {
        await get().stop();
        return;
      }
      const currentIdx = get().queue.findIndex((t) => t.id === current.id);
      if (currentIdx >= 0) {
        const nextQueue = [get().queue[currentIdx]];
        set({ queue: nextQueue });
        try {
          const rntpQueue = await TrackPlayer.getQueue();
          for (let i = rntpQueue.length - 1; i >= 0; i--) {
            if (i !== currentIdx) {
              await TrackPlayer.remove(i).catch(() => undefined);
            }
          }
        } catch {
          // Safe fallback
        }
      }
    },

    seekTo: async (sec) => {
      await TrackPlayer.seekTo(sec);
    },

    stop: async () => {
      pausedByInterruption = false;
      await TrackPlayer.reset();
      set({ currentTrack: null, queue: [], isPlaying: false, positionSec: 0 });
    },

    cycleRepeatMode: async () => {
      const current = get().repeatMode;
      const next =
        REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(current) + 1) % REPEAT_CYCLE.length];
      set({ repeatMode: next });
      await TrackPlayer.setRepeatMode(NATIVE_REPEAT_MODE[next]);
    },

    toggleShuffle: () => {
      set((s) => ({ shuffleEnabled: !s.shuffleEnabled }));
    },
  };
});
