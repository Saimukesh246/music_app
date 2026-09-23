import TrackPlayer, { Event, RepeatMode, State } from "react-native-track-player";
import { usePlayerStore } from "./playerStore";
import { tracks } from "@aura/shared";

jest.mock("../providers", () => ({
  getProvider: jest.fn().mockResolvedValue({
    getPlaybackSource: jest.fn((trackId: string) =>
      Promise.resolve({
        trackId,
        uri: `content://mock/${trackId}`,
        quality: { format: "FLAC", durationSec: 200 },
      })
    ),
  }),
  getLibraryDb: jest.fn().mockResolvedValue({
    recordPlay: jest.fn().mockResolvedValue(undefined),
  }),
}));

function fireEvent(event: Event, payload?: unknown) {
  const call = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  if (!call) throw new Error(`No listener registered for ${event}`);
  call[1](payload);
}

describe("usePlayerStore — event mirroring", () => {
  it("mirrors PlaybackState into isPlaying", () => {
    fireEvent(Event.PlaybackState, { state: State.Playing });
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    fireEvent(Event.PlaybackState, { state: State.Paused });
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("mirrors PlaybackProgressUpdated into positionSec", () => {
    fireEvent(Event.PlaybackProgressUpdated, { position: 42.5 });
    expect(usePlayerStore.getState().positionSec).toBe(42.5);
  });

  it("clears currentTrack when the active track becomes undefined", () => {
    fireEvent(Event.PlaybackActiveTrackChanged, { track: undefined });
    expect(usePlayerStore.getState().currentTrack).toBeNull();
  });
});

describe("usePlayerStore — playTrack", () => {
  it("places the selected track at index 0 and starts playback", async () => {
    await usePlayerStore
      .getState()
      .playTrack(tracks[1], [tracks[0], tracks[1], tracks[2]]);

    // The selected track (tracks[1]) is moved to index 0 in the RNTP queue.
    const setQueueCall = (TrackPlayer.setQueue as jest.Mock).mock.calls.at(-1)[0] as { id: string }[];
    expect(setQueueCall[0].id).toBe(tracks[1].id);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("mirrors PlaybackActiveTrackChanged into the full app Track via the internal id map", async () => {
    await usePlayerStore.getState().playTrack(tracks[0], [tracks[0]]);
    fireEvent(Event.PlaybackActiveTrackChanged, { track: { id: tracks[0].id } });
    expect(usePlayerStore.getState().currentTrack).toEqual(tracks[0]);
  });
});

describe("usePlayerStore — transport controls", () => {
  it("togglePlayPause calls pause() when currently playing", () => {
    fireEvent(Event.PlaybackState, { state: State.Playing });
    usePlayerStore.getState().togglePlayPause();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });

  it("togglePlayPause calls play() when currently paused", () => {
    fireEvent(Event.PlaybackState, { state: State.Paused });
    usePlayerStore.getState().togglePlayPause();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("playNext calls TrackPlayer.skipToNext()", () => {
    usePlayerStore.getState().playNext();
    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
  });

  it("playPrevious calls TrackPlayer.skipToPrevious()", () => {
    usePlayerStore.getState().playPrevious();
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
  });

  it("seekTo calls TrackPlayer.seekTo() with the given seconds", () => {
    usePlayerStore.getState().seekTo(120);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(120);
  });
});

describe("usePlayerStore — repeat mode", () => {
  it("cycles off -> all -> one -> off, calling setRepeatMode with the matching native constant", () => {
    const { cycleRepeatMode } = usePlayerStore.getState();

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("all");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Queue);

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("one");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Track);

    cycleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("off");
    expect(TrackPlayer.setRepeatMode).toHaveBeenLastCalledWith(RepeatMode.Off);
  });
});

describe("usePlayerStore — stop", () => {
  it("resets the native player and clears local state", async () => {
    await usePlayerStore.getState().stop();
    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(usePlayerStore.getState()).toMatchObject({
      currentTrack: null,
      queue: [],
      isPlaying: false,
      positionSec: 0,
    });
  });
});

describe("usePlayerStore — interruption handling", () => {
  it("resumes after a transient interruption ends", () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("does not resume after a permanent interruption ends", () => {
    (TrackPlayer.play as jest.Mock).mockClear();

    fireEvent(Event.RemoteDuck, { paused: true, permanent: true });
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if togglePlayPause ran during the interruption", () => {
    (TrackPlayer.play as jest.Mock).mockClear();

    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    usePlayerStore.getState().togglePlayPause();
    (TrackPlayer.play as jest.Mock).mockClear(); // clear the call toggle itself made
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if stop() ran during the interruption", async () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    await usePlayerStore.getState().stop();
    (TrackPlayer.play as jest.Mock).mockClear();
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });

  it("does not resume if playNext ran during the interruption", () => {
    fireEvent(Event.RemoteDuck, { paused: true, permanent: false });
    usePlayerStore.getState().playNext();
    (TrackPlayer.play as jest.Mock).mockClear();
    fireEvent(Event.RemoteDuck, { paused: false, permanent: false });

    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
});
describe("usePlayerStore — shuffle", () => {
  it("starts with shuffleEnabled = false", () => {
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false);
  });

  it("toggleShuffle toggles shuffleEnabled on then off", () => {
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffleEnabled).toBe(true);

    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffleEnabled).toBe(false);
  });

  it("when shuffle is enabled, the selected track is always at index 0 in the queue", async () => {
    // Enable shuffle first
    if (!usePlayerStore.getState().shuffleEnabled) {
      usePlayerStore.getState().toggleShuffle();
    }

    await usePlayerStore
      .getState()
      .playTrack(tracks[2], [tracks[0], tracks[1], tracks[2]]);

    // tracks[2] must be first
    expect(usePlayerStore.getState().queue[0].id).toBe(tracks[2].id);
    // RNTP always skips to index 0
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0);

    // Clean up
    usePlayerStore.getState().toggleShuffle();
  });

  it("when shuffle is disabled, the queue retains its original order with selected track first", async () => {
    if (usePlayerStore.getState().shuffleEnabled) {
      usePlayerStore.getState().toggleShuffle();
    }

    await usePlayerStore
      .getState()
      .playTrack(tracks[0], [tracks[0], tracks[1], tracks[2]]);

    const q = usePlayerStore.getState().queue;
    expect(q[0].id).toBe(tracks[0].id);
    expect(q[1].id).toBe(tracks[1].id);
    expect(q[2].id).toBe(tracks[2].id);
  });
});

describe("usePlayerStore — sleep timer", () => {
  it("starts with sleep timer disabled", () => {
    expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBeNull();
  });

  it("sets sleep timer and calculates seconds", () => {
    usePlayerStore.getState().setSleepTimer(15);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(15);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBe(900);
  });

  it("supports end of track mode (-1)", () => {
    usePlayerStore.getState().setSleepTimer(-1);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(-1);
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBeNull();
  });

  it("cancels sleep timer when set to null", () => {
    usePlayerStore.getState().setSleepTimer(30);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBe(30);

    usePlayerStore.getState().setSleepTimer(null);
    expect(usePlayerStore.getState().sleepTimerMinutes).toBeNull();
    expect(usePlayerStore.getState().sleepTimerRemainingSec).toBeNull();
  });
});
