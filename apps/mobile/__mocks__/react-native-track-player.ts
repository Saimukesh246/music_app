export enum Event {
  PlaybackState = "playback-state",
  PlaybackActiveTrackChanged = "playback-active-track-changed",
  PlaybackProgressUpdated = "playback-progress-updated",
  RemotePlay = "remote-play",
  RemotePause = "remote-pause",
  RemoteNext = "remote-next",
  RemotePrevious = "remote-previous",
  RemoteSeek = "remote-seek",
  RemoteStop = "remote-stop",
  RemoteDuck = "remote-duck",
}

export enum State {
  None = "none",
  Ready = "ready",
  Playing = "playing",
  Paused = "paused",
  Stopped = "stopped",
}

export enum RepeatMode {
  Off = 0,
  Track = 1,
  Queue = 2,
}

export enum Capability {
  Play = 0,
  Pause = 1,
  SkipToNext = 2,
  SkipToPrevious = 3,
  SeekTo = 4,
}

export enum AppKilledPlaybackBehavior {
  StopPlaybackAndRemoveNotification = 0,
}

const TrackPlayer = {
  setupPlayer: jest.fn().mockResolvedValue(undefined),
  updateOptions: jest.fn().mockResolvedValue(undefined),
  registerPlaybackService: jest.fn(),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  setQueue: jest.fn().mockResolvedValue(undefined),
  add: jest.fn().mockResolvedValue(undefined),
  skip: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  skipToNext: jest.fn().mockResolvedValue(undefined),
  skipToPrevious: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
  setRepeatMode: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
};

export default TrackPlayer;
