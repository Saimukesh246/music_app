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
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
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

  // True only while a transient interruption (RemoteDuck with
  // permanent: false) is in effect and nothing else has touched playback
  // since. Cleared by every explicit user/UI action below.
  let pausedByInterruption = false;

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
      const rntpTracks = await Promise.all(
        nextQueue.map(async (queuedTrack) => {
          trackById.set(queuedTrack.id, queuedTrack);
          const source = await provider.getPlaybackSource(queuedTrack.id);
          return toRNTPTrack(queuedTrack, source.uri);
        })
      );

      await TrackPlayer.setQueue(rntpTracks);
      await TrackPlayer.skip(0);
      await TrackPlayer.play();

      // Fire-and-forget: record the play. Never blocks playback.
      void getLibraryDb().then((db) => db.recordPlay(track.id)).catch(() => undefined);
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
      const provider = await getProvider();
      const source = await provider.getPlaybackSource(track.id);
      await TrackPlayer.add(toRNTPTrack(track, source.uri));
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
