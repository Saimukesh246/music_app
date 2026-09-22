import { useState } from "react";
import { View, TextInput, FlatList, Text, StyleSheet } from "react-native";
import type { SearchResults } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { provider } from "../providers";
import { TrackRow } from "../components/TrackRow";
import { usePlayerStore } from "../store/playerStore";

const EMPTY_RESULTS: SearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const playTrack = usePlayerStore((s) => s.playTrack);

  function handleChange(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setResults(EMPTY_RESULTS);
      return;
    }
    void provider.search(text).then(setResults);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search songs, albums, artists"
        placeholderTextColor={colors.textTertiary}
        value={query}
        onChangeText={handleChange}
      />
      {results.tracks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={typography.caption}>
            {query ? "No results" : "Search your music"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results.tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TrackRow track={item} onPress={() => playTrack(item, results.tracks)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  input: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
  },
  empty: {
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
});
