import { create } from "zustand";
import TrackPlayer, { Event, RepeatMode, State } from "react-native-track-player";
import type { Track } from "@aura/types";
import { getProvider } from "../providers";
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
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  addToQueue: (track: Track) => void;
  seekTo: (sec: number) => void;
  stop: () => void;
  cycleRepeatMode: () => void;
}

/**
 * RNTP events identify tracks by the id we gave them, not by the full app
 * Track object. This map is how PlaybackActiveTrackChanged gets back to a
 * real Track (with quality, album, etc.) for the store to expose.
 */
const trackById = new Map<string, Track>();

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

  return {
    currentTrack: null,
    queue: [],
    isPlaying: false,
    positionSec: 0,
    repeatMode: "off",

    playTrack: async (track, queue) => {
      const nextQueue = queue ?? get().queue;
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
      const index = nextQueue.findIndex((queuedTrack) => queuedTrack.id === track.id);
      await TrackPlayer.skip(index >= 0 ? index : 0);
      await TrackPlayer.play();
    },

    togglePlayPause: async () => {
      if (get().isPlaying) await TrackPlayer.pause();
      else await TrackPlayer.play();
    },

    playNext: async () => {
      await TrackPlayer.skipToNext();
    },

    playPrevious: async () => {
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
  };
});
