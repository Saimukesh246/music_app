jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///mock/documents/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, isDirectory: false, size: 5000000 }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  createDownloadResumable: jest.fn((_uri, fileUri, _options, callback) => ({
    downloadAsync: jest.fn().mockImplementation(async () => {
      if (callback) callback({ totalBytesWritten: 5000000, totalBytesExpectedToWrite: 5000000 });
      return { uri: fileUri };
    }),
  })),
}));

const mockDb = {
  getDownloadedTracks: jest.fn().mockResolvedValue([]),
  recordDownload: jest.fn().mockResolvedValue(undefined),
  removeDownload: jest.fn().mockResolvedValue(undefined),
  getDownloadedTrackUri: jest.fn().mockResolvedValue(null),
  isTrackDownloaded: jest.fn().mockResolvedValue(false),
};

const mockProvider = {
  getPlaybackSource: jest.fn().mockResolvedValue({
    trackId: "t1",
    uri: "https://archive.org/download/t1.flac",
    quality: { format: "FLAC", durationSec: 180 },
  }),
};

jest.mock("../providers", () => ({
  getLibraryDb: () => Promise.resolve(mockDb),
  getProvider: () => Promise.resolve(mockProvider),
}));

import * as FileSystem from "expo-file-system";
import { useDownloadStore } from "./downloadStore";
import type { Track } from "@aura/types";

const mockTrack: Track = {
  id: "t1",
  title: "Lossless Master",
  artistId: "a1",
  artistName: "Audiophile Artist",
  albumId: "al1",
  albumTitle: "Hi-Res Album",
  quality: { format: "FLAC", durationSec: 180, bitDepth: 24, sampleRateHz: 96000 },
};

beforeEach(() => {
  useDownloadStore.setState({
    downloadedTracks: new Map(),
    progress: {},
  });
  jest.clearAllMocks();
  mockDb.getDownloadedTracks.mockResolvedValue([]);
  mockDb.recordDownload.mockResolvedValue(undefined);
  mockDb.removeDownload.mockResolvedValue(undefined);
});

describe("useDownloadStore", () => {
  it("initializes with empty downloads and progress", () => {
    const { downloadedTracks, progress } = useDownloadStore.getState();
    expect(downloadedTracks.size).toBe(0);
    expect(Object.keys(progress)).toHaveLength(0);
  });

  it("hydrates downloaded tracks from SQLite", async () => {
    mockDb.getDownloadedTracks.mockResolvedValueOnce([
      {
        trackId: "t1",
        localUri: "file:///mock/documents/aura_downloads/t1.flac",
        downloadedAt: 1700000000,
        fileSizeBytes: 5000000,
      },
    ]);

    await useDownloadStore.getState().hydrateDownloads();
    expect(useDownloadStore.getState().isDownloaded("t1")).toBe(true);
    expect(useDownloadStore.getState().downloadedTracks.get("t1")?.fileSizeBytes).toBe(5000000);
  });

  it("downloads a track, updates progress, and saves to database", async () => {
    await useDownloadStore.getState().downloadTrack(mockTrack);

    expect(mockProvider.getPlaybackSource).toHaveBeenCalledWith("t1");
    expect(mockDb.recordDownload).toHaveBeenCalledWith(
      "t1",
      expect.stringContaining("t1.flac"),
      5000000
    );
    expect(useDownloadStore.getState().isDownloaded("t1")).toBe(true);
    expect(useDownloadStore.getState().getDownloadProgress("t1")).toBeUndefined();
  });

  it("deletes a downloaded track from filesystem and database", async () => {
    useDownloadStore.setState({
      downloadedTracks: new Map([
        [
          "t1",
          {
            trackId: "t1",
            localUri: "file:///mock/documents/aura_downloads/t1.flac",
            downloadedAt: 1700000000,
            fileSizeBytes: 5000000,
          },
        ],
      ]),
    });

    await useDownloadStore.getState().deleteDownload("t1");

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      "file:///mock/documents/aura_downloads/t1.flac",
      { idempotent: true }
    );
    expect(mockDb.removeDownload).toHaveBeenCalledWith("t1");
    expect(useDownloadStore.getState().isDownloaded("t1")).toBe(false);
  });
});
