import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { Album, Track } from "@aura/types";
import { recommendTracks } from "@aura/shared";
import { colors, spacing, typography } from "../theme/tokens";
import { ArtworkCard } from "../components/ArtworkCard";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryData, type LibraryStats } from "../hooks/useLibraryData";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// LibraryStatsCard
// ---------------------------------------------------------------------------

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={statStyles.pill} testID={`stat-pill-${label}`}>
      <View style={[statStyles.dot, { backgroundColor: color }]} />
      <Text style={[typography.label, { color: colors.textSecondary }]}>
        {count} {label}
      </Text>
    </View>
  );
}

function LibraryStatsCard({ stats }: { stats: LibraryStats }) {
  if (stats.totalTracks === 0) return null;
  return (
    <View style={statStyles.card} testID="library-stats-card">
      <Text style={[typography.label, statStyles.cardLabel]}>YOUR LIBRARY</Text>
      <Text style={typography.body}>
        {stats.totalTracks} track{stats.totalTracks !== 1 ? "s" : ""} · {stats.totalHours}h
      </Text>
      <View style={statStyles.pills}>
        {stats.hiRes > 0 && (
          <StatPill label="Hi-Res" count={stats.hiRes} color={colors.hiRes} />
        )}
        {stats.lossless > 0 && (
          <StatPill label="Lossless" count={stats.lossless} color={colors.lossless} />
        )}
        {stats.lossy > 0 && (
          <StatPill label="Lossy" count={stats.lossy} color={colors.lossy} />
        )}
        {stats.unknown > 0 && (
          <StatPill label="Unknown" count={stats.unknown} color={colors.textTertiary} />
        )}
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardLabel: {
    marginBottom: spacing.xs,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function Section({
  title,
  albums: sectionAlbums,
}: {
  title: string;
  albums: Album[];
  tracks: Track[];
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (sectionAlbums.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[typography.heading, styles.sectionTitle]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sectionAlbums.map((album) => (
          <ArtworkCard
            key={album.id}
            title={album.title}
            subtitle={album.artistName}
            artworkUrl={album.artworkUrl}
            onPress={() => {
              navigation.navigate("AlbumDetail", { albumId: album.id });
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function albumsFromTracks(recommendedTracks: Track[], allAlbums: Album[]): Album[] {
  const albumById = new Map(allAlbums.map((album) => [album.id, album]));
  const seen = new Set<string>();
  const result: Album[] = [];
  for (const track of recommendedTracks) {
    if (seen.has(track.albumId)) continue;
    const album = albumById.get(track.albumId);
    if (album) {
      seen.add(track.albumId);
      result.push(album);
    }
  }
  return result;
}

/**
 * Sort albums by total play count of their tracks (descending).
 * Falls back to the original array order (i.e. recently added) when there's
 * no play history at all.
 */
function heavyRotationAlbums(
  tracks: Track[],
  albums: Album[],
  playCountsMap: Map<string, number>
): Album[] {
  if (playCountsMap.size === 0) return albums;

  // Sum play counts per album
  const albumScore = new Map<string, number>();
  for (const t of tracks) {
    const cnt = playCountsMap.get(t.id) ?? 0;
    albumScore.set(t.albumId, (albumScore.get(t.albumId) ?? 0) + cnt);
  }

  return [...albums]
    .filter((a) => (albumScore.get(a.id) ?? 0) > 0)
    .sort((a, b) => (albumScore.get(b.id) ?? 0) - (albumScore.get(a.id) ?? 0));
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export function HomeScreen() {
  const { tracks, albums, loading, playCountsMap, libStats } = useLibraryData();
  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);

  const hiRes = albums.filter((album) =>
    tracks.some(
      (t) =>
        t.albumId === album.id &&
        (t.quality.bitDepth ?? 0) > 16 &&
        t.quality.format === "FLAC"
    )
  );

  const favoriteTracks = tracks.filter((t) => favoriteTrackIds.has(t.id));
  const recommended = albumsFromTracks(recommendTracks(tracks, favoriteTracks, 10), albums);
  const heavyRotation = heavyRotationAlbums(tracks, albums, playCountsMap);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.title, styles.greeting]}>{greeting()}</Text>
      {!loading && albums.length === 0 ? (
        <Text style={[typography.caption, styles.greeting]}>
          Your library is empty. Add music from Settings › Scan Music Folder.
        </Text>
      ) : null}
      <LibraryStatsCard stats={libStats} />
      <Section title="Recently Added" albums={[...albums].reverse()} tracks={tracks} />
      <Section title="Hi-Res Collection" albums={hiRes} tracks={tracks} />
      <Section title="Your Heavy Rotation" albums={heavyRotation} tracks={tracks} />
      <Section title="Recommended For You" albums={recommended} tracks={tracks} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  greeting: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});
