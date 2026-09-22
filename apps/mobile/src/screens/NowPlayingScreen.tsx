import { View, Text, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { QualityBadge } from "../components/QualityBadge";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "NowPlaying">;

const REPEAT_LABEL: Record<string, string> = {
  off: "⟲",
  all: "⟲ ALL",
  one: "⟲ ONE",
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function NowPlayingScreen({ navigation }: Props) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionSec = usePlayerStore((s) => s.positionSec);
  const togglePlayPause = usePlayerStore((s) => s.togglePlayPause);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode);
  const isFavorite = useLibraryStore((s) =>
    currentTrack ? s.isFavorite(currentTrack.id) : false
  );
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={typography.body}>Nothing playing</Text>
      </View>
    );
  }

  const progress = Math.min(1, positionSec / currentTrack.quality.durationSec);

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={typography.caption}>Close</Text>
      </Pressable>

      <View style={styles.artwork} />

      <View style={styles.meta}>
        <Text style={typography.title} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={typography.body} numberOfLines={1}>
          {currentTrack.artistName} — {currentTrack.albumTitle}
        </Text>
      </View>

      <QualityBadge quality={currentTrack.quality} />

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Text style={typography.caption}>{formatTime(positionSec)}</Text>
        <Text style={typography.caption}>
          {formatTime(currentTrack.quality.durationSec)}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={playPrevious}>
          <Text style={styles.controlIcon}>⏮</Text>
        </Pressable>
        <Pressable onPress={togglePlayPause}>
          <Text style={styles.playPauseIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable onPress={playNext}>
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>
        <Pressable onPress={cycleRepeatMode}>
          <Text
            style={[
              styles.controlIcon,
              repeatMode !== "off" && { color: colors.accent },
            ]}
          >
            {REPEAT_LABEL[repeatMode]}
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => toggleFavorite(currentTrack.id)}>
        <Text style={{ color: isFavorite ? colors.accent : colors.textTertiary, fontSize: 22 }}>
          {isFavorite ? "♥" : "♡"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    alignItems: "center",
  },
  closeButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.lg,
  },
  meta: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.lg,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  controlIcon: {
    fontSize: 22,
    color: colors.textPrimary,
  },
  playPauseIcon: {
    fontSize: 32,
    color: colors.textPrimary,
  },
});
