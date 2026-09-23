import { Modal, View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import type { Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";
import { getQualityLabel } from "./QualityBadge";
import TrackPlayer from "react-native-track-player";

function formatDuration(sec: number): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface QueueSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function QueueSheet({ visible, onClose }: QueueSheetProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  async function handleRemove(index: number) {
    try {
      await TrackPlayer.remove(index);
    } catch {
      // RNTP may reject if the index is the active track; swallow gracefully.
    }
  }

  function renderItem({ item, index }: { item: Track; index: number }) {
    const isCurrent = item.id === currentTrack?.id;
    return (
      <View
        style={[styles.row, isCurrent && styles.rowCurrent]}
        testID={`queue-item-${index}`}
      >
        <View style={styles.trackInfo}>
          <Text
            style={[typography.body, isCurrent && { color: colors.accent }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {item.artistName} · {getQualityLabel(item.quality)}
          </Text>
        </View>
        <Text style={[typography.caption, styles.duration]}>
          {formatDuration(item.quality.durationSec)}
        </Text>
        {!isCurrent && (
          <Pressable
            onPress={() => void handleRemove(index)}
            hitSlop={10}
            style={styles.removeBtn}
            accessibilityLabel={`Remove ${item.title} from queue`}
          >
            <Text style={styles.removeIcon}>×</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="queue-sheet-modal"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.heading]}>Up Next</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close queue">
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        {queue.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              Queue is empty
            </Text>
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(t) => t.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  closeIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rowCurrent: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    marginHorizontal: spacing.xs,
  },
  trackInfo: {
    flex: 1,
  },
  duration: {
    color: colors.textTertiary,
    minWidth: 40,
    textAlign: "right",
  },
  removeBtn: {
    paddingLeft: spacing.sm,
  },
  removeIcon: {
    fontSize: 20,
    color: colors.textTertiary,
    lineHeight: 22,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
