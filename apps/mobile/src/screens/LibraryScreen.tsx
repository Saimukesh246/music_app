import { View, FlatList, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { TrackRow } from "../components/TrackRow";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryData } from "../hooks/useLibraryData";

export function LibraryScreen() {
  const { tracks } = useLibraryData();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);
  const favoriteTracks = tracks.filter((t) => favoriteTrackIds.has(t.id));

  return (
    <View style={styles.container}>
      <Text style={[typography.title, styles.title]}>Your Library</Text>
      <Text style={[typography.heading, styles.subheading]}>Favorites</Text>
      {favoriteTracks.length === 0 ? (
        <Text style={[typography.caption, styles.empty]}>
          Tap ♡ on any track to add it here.
        </Text>
      ) : (
        <FlatList
          data={favoriteTracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackRow track={item} onPress={() => playTrack(item, favoriteTracks)} />
          )}
        />
      )}
      <Text style={[typography.heading, styles.subheading]}>All Tracks</Text>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TrackRow track={item} onPress={() => playTrack(item, tracks)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  title: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  subheading: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: {
    paddingHorizontal: spacing.md,
  },
});
