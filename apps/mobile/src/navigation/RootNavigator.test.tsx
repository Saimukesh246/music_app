import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { RootNavigator } from "./RootNavigator";
import { usePlayerStore } from "../store/playerStore";
import { tracks } from "@aura/shared";

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => {},
    runAsync: async () => {},
    getAllAsync: async () => [],
  }),
}));

describe("RootNavigator", () => {
  afterEach(async () => {
    await usePlayerStore.getState().stop();
  });

  it("renders the Home tab by default with the greeting", async () => {
    render(<RootNavigator />);
    await waitFor(() => {
      expect(
        screen.getByText(/Good (morning|afternoon|evening)/)
      ).toBeTruthy();
    });
  });

  it("switches to the Search tab and queries the library", async () => {
    render(<RootNavigator />);
    fireEvent.press(screen.getByText("Search"));
    fireEvent.changeText(
      screen.getByPlaceholderText("Search songs, albums, artists"),
      "Low Tide"
    );
    // The real LocalProvider is wired here (backed by a mocked, empty
    // database), so an unmatched query surfaces the empty state rather
    // than a fixture track.
    await waitFor(() => {
      expect(screen.getByText("No results")).toBeTruthy();
    });
  });

  it("opens Now Playing from the mini-player once a track is playing", async () => {
    // This test exercises mini-player -> Now Playing navigation, not
    // playTrack's DB integration (playerStore.test.ts covers that with a
    // properly mocked provider). Driving the store directly avoids routing
    // through the real LocalProvider, which — backed by this file's
    // mocked, empty database — would legitimately fail to find the
    // fixture track.
    usePlayerStore.setState({ currentTrack: tracks[0], queue: tracks, isPlaying: true });

    render(<RootNavigator />);
    await waitFor(() => {
      expect(screen.getAllByText("Low Tide").length).toBeGreaterThan(0);
    });
    fireEvent.press(screen.getAllByText("Low Tide")[0]);
    await waitFor(() => {
      expect(screen.getByText("Close")).toBeTruthy();
    });
  });
});
