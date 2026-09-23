/**
 * Tests for usePlaylistStore.
 */

const mockDb = {
  getPlaylists: jest.fn(),
  createPlaylist: jest.fn(),
  deletePlaylist: jest.fn(),
  renamePlaylist: jest.fn(),
  addTrackToPlaylist: jest.fn(),
  removeTrackFromPlaylist: jest.fn(),
};

jest.mock("../providers", () => ({
  getLibraryDb: () => Promise.resolve(mockDb),
}));

import { usePlaylistStore } from "./playlistStore";

beforeEach(() => {
  usePlaylistStore.setState({ playlists: [] });
  mockDb.getPlaylists.mockReset().mockResolvedValue([]);
  mockDb.createPlaylist.mockReset().mockResolvedValue("new-id");
  mockDb.deletePlaylist.mockReset().mockResolvedValue(undefined);
  mockDb.renamePlaylist.mockReset().mockResolvedValue(undefined);
  mockDb.addTrackToPlaylist.mockReset().mockResolvedValue(undefined);
  mockDb.removeTrackFromPlaylist.mockReset().mockResolvedValue(undefined);
});

describe("usePlaylistStore — hydrate", () => {
  it("loads playlists from the database", async () => {
    mockDb.getPlaylists.mockResolvedValueOnce([
      { id: "p1", title: "Jazz" },
      { id: "p2", title: "Rock" },
    ]);
    usePlaylistStore.getState().hydrate();
    await new Promise((r) => setTimeout(r, 50));
    expect(usePlaylistStore.getState().playlists).toHaveLength(2);
  });
});

describe("usePlaylistStore — createPlaylist", () => {
  it("calls the DB, returns the new id, and inserts sorted by title", async () => {
    mockDb.createPlaylist.mockResolvedValueOnce("p-jazz");
    usePlaylistStore.setState({
      playlists: [{ id: "p-rock", title: "Rock" }],
    });
    const id = await usePlaylistStore.getState().createPlaylist("Ambient");
    expect(id).toBe("p-jazz");
    expect(mockDb.createPlaylist).toHaveBeenCalledWith("Ambient");
    const titles = usePlaylistStore.getState().playlists.map((p) => p.title);
    expect(titles).toEqual(["Ambient", "Rock"]);
  });
});

describe("usePlaylistStore — deletePlaylist", () => {
  it("removes from state and calls the DB", async () => {
    usePlaylistStore.setState({
      playlists: [
        { id: "p1", title: "A" },
        { id: "p2", title: "B" },
      ],
    });
    await usePlaylistStore.getState().deletePlaylist("p1");
    expect(mockDb.deletePlaylist).toHaveBeenCalledWith("p1");
    expect(usePlaylistStore.getState().playlists).toEqual([{ id: "p2", title: "B" }]);
  });
});

describe("usePlaylistStore — renamePlaylist", () => {
  it("updates state optimistically and calls the DB", async () => {
    usePlaylistStore.setState({
      playlists: [{ id: "p1", title: "Old Name" }],
    });
    await usePlaylistStore.getState().renamePlaylist("p1", "New Name");
    expect(mockDb.renamePlaylist).toHaveBeenCalledWith("p1", "New Name");
    expect(usePlaylistStore.getState().playlists[0].title).toBe("New Name");
  });
});

describe("usePlaylistStore — addTrackToPlaylist", () => {
  it("delegates to the DB", async () => {
    await usePlaylistStore.getState().addTrackToPlaylist("p1", "t1");
    expect(mockDb.addTrackToPlaylist).toHaveBeenCalledWith("p1", "t1");
  });
});

describe("usePlaylistStore — removeTrackFromPlaylist", () => {
  it("delegates to the DB", async () => {
    await usePlaylistStore.getState().removeTrackFromPlaylist("p1", "t1");
    expect(mockDb.removeTrackFromPlaylist).toHaveBeenCalledWith("p1", "t1");
  });
});
