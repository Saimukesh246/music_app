import { Pressable, View, Text, StyleSheet } from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";

export function MiniPlayer({ onPress }: { onPress: () => void }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);

  if (!currentTrack) return null;

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.artwork} />
      <View style={styles.info}>
        <Text style={typography.body} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {currentTrack.artistName}
        </Text>
      </View>
      <Pressable hitSlop={12} onPress={togglePlayPause}>
        <Text style={styles.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  artwork: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  info: {
    flex: 1,
  },
  playIcon: {
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: spacing.sm,
  },
});
