import { Pressable, View, Text, Image, StyleSheet } from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";

export function MiniPlayer({ onPress }: { onPress: () => void }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const playNext = usePlayerStore((s) => s.playNext);

  if (!currentTrack) return null;

  const durationSec = currentTrack.quality?.durationSec || 0;
  const progressPercent =
    durationSec > 0 ? Math.min(100, Math.max(0, (positionSec / durationSec) * 100)) : 0;

  const formatText = currentTrack.quality?.bitDepth
    ? `${currentTrack.quality.bitDepth}-BIT`
    : currentTrack.quality?.format || "LOSSLESS";

  return (
    <Pressable style={styles.container} onPress={onPress} testID="mini-player">
      {/* Top progress line */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* Track Artwork */}
      {currentTrack.artworkUrl ? (
        <Image
          source={{ uri: currentTrack.artworkUrl }}
          style={styles.artwork}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.artworkPlaceholder}>
          <Text style={styles.artworkPlaceholderText}>♪</Text>
        </View>
      )}

      {/* Track Title & Artist */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[typography.body, styles.titleText]} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <View style={styles.qualityTag}>
            <Text style={styles.qualityTagText}>{formatText}</Text>
          </View>
        </View>
        <Text style={[typography.caption, styles.artistText]} numberOfLines={1}>
          {currentTrack.artistName}
        </Text>
      </View>

      {/* Play/Pause Button */}
      <Pressable
        hitSlop={12}
        onPress={togglePlayPause}
        style={styles.actionBtn}
        testID="mini-player-play-pause"
      >
        <Text style={styles.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
      </Pressable>

      {/* Next Button */}
      <Pressable
        hitSlop={12}
        onPress={() => void playNext()}
        style={styles.actionBtn}
        testID="mini-player-next"
      >
        <Text style={styles.nextIcon}>⏭</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: "#161620",
    borderTopWidth: 1,
    borderTopColor: "#262634",
    position: "relative",
  },
  progressBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#20202c",
  },
  progressBarFill: {
    height: 2,
    backgroundColor: colors.accent,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
  },
  artworkPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: "#22222e",
    alignItems: "center",
    justifyContent: "center",
  },
  artworkPlaceholderText: {
    color: colors.accent,
    fontSize: 18,
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleText: {
    fontWeight: "600",
    color: "#f5f5f7",
    flexShrink: 1,
  },
  qualityTag: {
    backgroundColor: "rgba(200, 169, 110, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  qualityTagText: {
    fontSize: 9,
    color: colors.accent,
    fontWeight: "700",
  },
  artistText: {
    color: colors.textTertiary,
    marginTop: 2,
  },
  actionBtn: {
    padding: 6,
  },
  playIcon: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  nextIcon: {
    color: colors.textTertiary,
    fontSize: 14,
  },
});
