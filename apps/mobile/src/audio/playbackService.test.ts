import TrackPlayer, { Event } from "react-native-track-player";
import { PlaybackService } from "./playbackService";

function findListener(event: Event): (payload?: unknown) => void {
  const call = (TrackPlayer.addEventListener as jest.Mock).mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  if (!call) throw new Error(`No listener registered for ${event}`);
  return call[1];
}

describe("PlaybackService", () => {
  it("calls TrackPlayer.play() on RemotePlay", async () => {
    await PlaybackService();
    findListener(Event.RemotePlay)();
    expect(TrackPlayer.play).toHaveBeenCalled();
  });

  it("calls TrackPlayer.pause() on RemotePause", async () => {
    await PlaybackService();
    findListener(Event.RemotePause)();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });

  it("calls TrackPlayer.skipToNext() on RemoteNext", async () => {
    await PlaybackService();
    findListener(Event.RemoteNext)();
    expect(TrackPlayer.skipToNext).toHaveBeenCalled();
  });

  it("calls TrackPlayer.skipToPrevious() on RemotePrevious", async () => {
    await PlaybackService();
    findListener(Event.RemotePrevious)();
    expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
  });

  it("calls TrackPlayer.seekTo() with the requested position on RemoteSeek", async () => {
    await PlaybackService();
    findListener(Event.RemoteSeek)({ position: 87 });
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(87);
  });

  it("calls TrackPlayer.pause() on RemoteStop", async () => {
    await PlaybackService();
    findListener(Event.RemoteStop)();
    expect(TrackPlayer.pause).toHaveBeenCalled();
  });
});
