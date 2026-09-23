import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlayerStore } from "../store/playerStore";
import { useDownloadStore } from "../store/downloadStore";
import { QualityBadge } from "../components/QualityBadge";
import { TrackRow } from "../components/TrackRow";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AlbumDetail">;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min${m !== 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h} hr${h !== 1 ? "s" : ""}${remM > 0 ? ` ${remM} min${remM !== 1 ? "s" : ""}` : ""}`;
}

export function AlbumDetailScreen({ route, navigation }: Props) {
  const { albumId } = route.params;
  const { albums, tracks } = useLibraryData();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const { isDownloaded, downloadTrack } = useDownloadStore();

  const album = albums.find((a) => a.id === albumId);
  const albumTracks = tracks
    .filter((t) => t.albumId === albumId)
    .sort((a, b) => {
      const numA = (a.quality as unknown as { trackNumber?: number }).trackNumber ?? 0;
      const numB = (b.quality as unknown as { trackNumber?: number }).trackNumber ?? 0;
      return numA - numB;
    });

  const title = album?.title || albumTracks[0]?.albumTitle || "Album";
  const artistName = album?.artistName || albumTracks[0]?.artistName || "Unknown Artist";
  const artistId = album?.artistId || albumTracks[0]?.artistId || "";
  const artworkUrl = album?.artworkUrl || albumTracks[0]?.artworkUrl;
  const releaseYear = album?.releaseYear;

  const totalDurationSec = albumTracks.reduce(
    (sum, t) => sum + (t.quality.durationSec || 0),
    0
  );

  // Highest quality sample in album
  const maxQuality = albumTracks[0]?.quality;

  const downloadedCount = albumTracks.filter((t) => isDownloaded(t.id)).length;
  const allDownloaded = albumTracks.length > 0 && downloadedCount === albumTracks.length;

  function handlePlayAll() {
    if (albumTracks.length > 0) {
      playTrack(albumTracks[0], albumTracks);
    }
  }

  function handleShuffle() {
    if (albumTracks.length === 0) return;
    const shuffled = [...albumTracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  }

  function handleDownloadAlbum() {
    for (const t of albumTracks) {
      if (!isDownloaded(t.id)) {
        void downloadTrack(t);
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Background tint from artwork */}
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          style={styles.bgTint}
          blurRadius={50}
          resizeMode="cover"
          accessibilityElementsHidden
        />
      ) : null}

      {/* Top Header / Back */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          testID="album-back-btn"
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Artwork Header Card */}
        <View style={styles.heroSection}>
          <View style={styles.artworkWrapper}>
            {artworkUrl ? (
              <Image source={{ uri: artworkUrl }} style={styles.artwork} resizeMode="cover" />
            ) : (
              <View style={styles.artworkPlaceholder} />
            )}
          </View>

          <Text style={[typography.title, styles.title]} numberOfLines={2}>
            {title}
          </Text>

          {/* Clickable Artist Name */}
          <Pressable
            onPress={() => artistId && navigation.navigate("ArtistDetail", { artistId })}
            style={styles.artistLink}
            testID="album-artist-link"
          >
            <Text style={[typography.body, styles.artistText]}>{artistName}</Text>
          </Pressable>

          {/* Metadata pill line */}
          <Text style={styles.metaLine}>
            {releaseYear ? `${releaseYear} · ` : ""}
            {albumTracks.length} track{albumTracks.length !== 1 ? "s" : ""} ·{" "}
            {formatDuration(totalDurationSec)}
          </Text>

          {/* Quality Badge */}
          {maxQuality && (
            <View style={styles.badgeRow}>
              <QualityBadge quality={maxQuality} />
            </View>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={handlePlayAll}
              style={[styles.primaryBtn, albumTracks.length === 0 && styles.btnDisabled]}
              disabled={albumTracks.length === 0}
              testID="album-play-all-btn"
            >
              <Text style={styles.primaryBtnText}>▶ Play All</Text>
            </Pressable>

            <Pressable
              onPress={handleShuffle}
              style={[styles.secondaryBtn, albumTracks.length === 0 && styles.btnDisabled]}
              disabled={albumTracks.length === 0}
              testID="album-shuffle-btn"
            >
              <Text style={styles.secondaryBtnText}>⇄ Shuffle</Text>
            </Pressable>

            <Pressable
              onPress={handleDownloadAlbum}
              style={[styles.secondaryBtn, allDownloaded && styles.btnActive]}
              disabled={albumTracks.length === 0 || allDownloaded}
              testID="album-download-btn"
            >
              <Text style={[styles.secondaryBtnText, allDownloaded && { color: colors.accent }]}>
                {allDownloaded ? "✓ Downloaded" : "⬇ Download"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksSection}>
          <Text style={[typography.heading, styles.sectionTitle]}>Tracks</Text>
          {albumTracks.map((item, index) => (
            <View key={item.id} style={styles.trackRowWrapper}>
              <Text style={styles.trackNumber}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <TrackRow track={item} onPress={() => playTrack(item, albumTracks)} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
  },
  topBar: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backIcon: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 28,
  },
  content: {
    paddingBottom: spacing.xxl + spacing.lg,
  },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  artworkWrapper: {
    width: 180,
    height: 180,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  artistLink: {
    paddingVertical: 2,
    marginBottom: 6,
  },
  artistText: {
    color: colors.accent,
    fontWeight: "600",
  },
  metaLine: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  primaryBtnText: {
    ...typography.caption,
    fontWeight: "800",
    color: colors.background,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  btnActive: {
    borderColor: colors.accent,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  tracksSection: {
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  trackRowWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackNumber: {
    width: 24,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
    marginRight: 4,
  },
});
