import { Pressable, View, Text, StyleSheet } from "react-native";
import type { Track } from "@aura/types";
import { colors, spacing, typography } from "../theme/tokens";
import { getQualityLabel } from "./QualityBadge";
import { useLibraryStore } from "../store/libraryStore";

function formatDuration(sec: number): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function TrackRow({ track, onPress }: { track: Track; onPress: () => void }) {
  const isFavorite = useLibraryStore((s) => s.isFavorite(track.id));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const qualityLabel = getQualityLabel(track.quality);

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.info}>
        <Text style={typography.body} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {track.artistName} · {qualityLabel}
        </Text>
      </View>
      <Text style={typography.caption}>{formatDuration(track.quality.durationSec)}</Text>
      <Pressable
        hitSlop={12}
        onPress={() => toggleFavorite(track.id)}
        style={styles.favoriteButton}
      >
        <Text style={{ color: isFavorite ? colors.accent : colors.textTertiary }}>
          {isFavorite ? "♥" : "♡"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  info: {
    flex: 1,
  },
  favoriteButton: {
    paddingLeft: spacing.sm,
  },
});
