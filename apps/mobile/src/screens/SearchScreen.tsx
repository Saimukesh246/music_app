import { useState, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SearchResults, Artist, Album, Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { getProvider } from "../providers";
import { TrackRow } from "../components/TrackRow";
import { ArtworkCard } from "../components/ArtworkCard";
import { usePlayerStore } from "../store/playerStore";
import type { RootStackParamList } from "../navigation/RootNavigator";

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type SearchCategory = "All" | "Tracks" | "Albums" | "Artists";

const CATEGORIES: SearchCategory[] = ["All", "Tracks", "Albums", "Artists"];
const RECENT_KEY = "@aura_recent_searches";
const MAX_RECENTS = 8;
const EMPTY_RESULTS: SearchResults = { tracks: [], albums: [], artists: [], playlists: [] };

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [category, setCategory] = useState<SearchCategory>("All");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation<NavProp>();
  const playTrack = usePlayerStore((s) => s.playTrack);

  useEffect(() => {
    void loadRecentSearches();
  }, []);

  async function loadRecentSearches() {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      if (raw) {
        setRecentSearches(JSON.parse(raw));
      }
    } catch {
      // Ignored
    }
  }

  async function saveRecentSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(
      0,
      MAX_RECENTS
    );
    setRecentSearches(next);
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Ignored
    }
  }

  async function clearRecentSearches() {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(RECENT_KEY);
    } catch {
      // Ignored
    }
  }

  function handleSearch(text: string) {
    setQuery(text);
    if (!text.trim()) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getProvider()
      .then((provider) => provider.search(text))
      .then((res) => {
        setResults(res);
        setLoading(false);
      })
      .catch(() => {
        setResults(EMPTY_RESULTS);
        setLoading(false);
      });
  }

  function handleSubmitSearch() {
    if (query.trim()) {
      void saveRecentSearch(query);
    }
  }

  function handleSelectRecent(term: string) {
    handleSearch(term);
    void saveRecentSearch(term);
  }

  const hasResults =
    results.tracks.length > 0 || results.albums.length > 0 || results.artists.length > 0;

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search songs, albums, artists"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          onSubmitEditing={handleSubmitSearch}
          returnKeyType="search"
          testID="search-input"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery("");
              setResults(EMPTY_RESULTS);
            }}
            style={styles.clearBtn}
            testID="search-clear-btn"
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Category Pills */}
      {query.trim().length > 0 && (
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
              testID={`search-filter-${cat}`}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Query is empty: Show Recent Searches & Discover suggestions */}
      {!query.trim() && (
        <ScrollView style={styles.idleContainer} contentContainerStyle={styles.idleContent}>
          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>RECENT SEARCHES</Text>
                <Pressable onPress={clearRecentSearches} testID="clear-recents-btn">
                  <Text style={styles.clearRecentsText}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.chipGrid}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => handleSelectRecent(term)}
                    style={styles.recentChip}
                    testID={`recent-chip-${term}`}
                  >
                    <Text style={styles.recentChipText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.exploreSection}>
            <Text style={styles.sectionTitle}>BROWSE GENRES & AUDIO FORMATS</Text>
            <View style={styles.chipGrid}>
              {["Hi-Res FLAC", "Lossless", "Acoustic", "Jazz", "Electronic", "Rock", "Live Archive"].map(
                (tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => handleSelectRecent(tag)}
                    style={styles.exploreChip}
                  >
                    <Text style={styles.exploreChipText}>{tag}</Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Results View */}
      {query.trim().length > 0 && !hasResults && !loading && (
        <View style={styles.empty}>
          <Text style={typography.caption}>No results</Text>
        </View>
      )}

      {query.trim().length > 0 && hasResults && (
        <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>
          {/* ALL Category View */}
          {category === "All" && (
            <>
              {/* Artists Section */}
              {results.artists.length > 0 && (
                <View style={styles.resultGroup}>
                  <Text style={styles.resultGroupTitle}>ARTISTS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistList}>
                    {results.artists.map((artist) => (
                      <Pressable
                        key={artist.id}
                        onPress={() => navigation.navigate("ArtistDetail", { artistId: artist.id })}
                        style={styles.artistCard}
                        testID={`search-artist-${artist.id}`}
                      >
                        <View style={styles.artistAvatar}>
                          <Text style={styles.artistAvatarInitial}>
                            {artist.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.artistCardName} numberOfLines={1}>
                          {artist.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Albums Section */}
              {results.albums.length > 0 && (
                <View style={styles.resultGroup}>
                  <Text style={styles.resultGroupTitle}>ALBUMS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumList}>
                    {results.albums.map((album) => (
                      <ArtworkCard
                        key={album.id}
                        title={album.title}
                        subtitle={album.artistName}
                        artworkUrl={album.artworkUrl}
                        onPress={() => navigation.navigate("AlbumDetail", { albumId: album.id })}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Tracks Section */}
              {results.tracks.length > 0 && (
                <View style={styles.resultGroup}>
                  <Text style={styles.resultGroupTitle}>TRACKS</Text>
                  {results.tracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      onPress={() => playTrack(track, results.tracks)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {/* TRACKS Category View */}
          {category === "Tracks" && (
            <View>
              {results.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  onPress={() => playTrack(track, results.tracks)}
                />
              ))}
            </View>
          )}

          {/* ALBUMS Category View */}
          {category === "Albums" && (
            <View style={styles.albumsGrid}>
              {results.albums.map((album) => (
                <ArtworkCard
                  key={album.id}
                  title={album.title}
                  subtitle={album.artistName}
                  artworkUrl={album.artworkUrl}
                  onPress={() => navigation.navigate("AlbumDetail", { albumId: album.id })}
                />
              ))}
            </View>
          )}

          {/* ARTISTS Category View */}
          {category === "Artists" && (
            <View>
              {results.artists.map((artist) => (
                <Pressable
                  key={artist.id}
                  onPress={() => navigation.navigate("ArtistDetail", { artistId: artist.id })}
                  style={styles.artistRow}
                  testID={`search-artist-row-${artist.id}`}
                >
                  <View style={styles.artistRowAvatar}>
                    <Text style={styles.artistAvatarInitial}>
                      {artist.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[typography.body, styles.artistRowName]}>{artist.name}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    position: "relative",
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 40,
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  clearText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.background,
  },
  idleContainer: {
    flex: 1,
  },
  idleContent: {
    padding: spacing.md,
  },
  recentSection: {
    marginBottom: spacing.lg,
  },
  exploreSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  clearRecentsText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  recentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentChipText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  exploreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: "rgba(0, 229, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.2)",
  },
  exploreChipText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: spacing.xxl + spacing.lg,
  },
  resultGroup: {
    marginBottom: spacing.md,
  },
  resultGroupTitle: {
    ...typography.caption,
    color: colors.textTertiary,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  artistList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  artistCard: {
    alignItems: "center",
    width: 80,
  },
  artistAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 4,
  },
  artistAvatarInitial: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
  },
  artistCardName: {
    ...typography.caption,
    color: colors.textPrimary,
    textAlign: "center",
  },
  albumList: {
    paddingHorizontal: spacing.md,
  },
  albumsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  artistRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  artistRowName: {
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: colors.textTertiary,
  },
});
