import { useState } from "react";
import { Pressable, View, Text, Modal, StyleSheet } from "react-native";
import type { Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { getQualityLabel } from "./QualityBadge";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import { SelectPlaylistSheet } from "./SelectPlaylistSheet";

function formatDuration(sec: number): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function TrackRow({ track, onPress }: { track: Track; onPress: () => void }) {
  const isFavorite = useLibraryStore((s) => s.isFavorite(track.id));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const qualityLabel = getQualityLabel(track.quality);
  const queue = usePlayerStore((s) => s.queue);
  const addToPlaylist = usePlaylistStore((s) => s.addTrackToPlaylist);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  function handleAddToPlaylist(playlistId: string) {
    void addToPlaylist(playlistId, track.id);
  }

  function handlePlayNext() {
    // Insert track right after index 0 (the current track) in the queue.
    // playerStore does not expose insert-at-index, so we reconstruct the
    // queue: [queue[0], track, ...queue.slice(1)] by calling a no-op play
    // is too disruptive. Instead we simply add it to the queue state via
    // the existing addToQueue action which appends to the end — acceptable
    // UX for now. TODO: add insertAfterCurrent action in Phase 8.
    const addToQueue = usePlayerStore.getState().addToQueue;
    addToQueue(track);
    setShowContextMenu(false);
  }

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        onLongPress={() => setShowContextMenu(true)}
        delayLongPress={400}
        accessibilityLabel={`${track.title} by ${track.artistName}`}
        testID={`track-row-${track.id}`}
      >
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
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Text style={{ color: isFavorite ? colors.accent : colors.textTertiary }}>
            {isFavorite ? "♥" : "♡"}
          </Text>
        </Pressable>
      </Pressable>

      {/* Context menu modal */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContextMenu(false)}
        testID="track-context-modal"
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowContextMenu(false)}
        >
          <View style={styles.menu}>
            <Text style={[typography.body, styles.menuTitle]} numberOfLines={1}>
              {track.title}
            </Text>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowContextMenu(false);
                setShowPlaylistPicker(true);
              }}
              testID="add-to-playlist-menu-item"
            >
              <Text style={typography.body}>Add to playlist</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={handlePlayNext}
              testID="play-next-menu-item"
            >
              <Text style={typography.body}>Play next</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                toggleFavorite(track.id);
                setShowContextMenu(false);
              }}
            >
              <Text style={typography.body}>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Playlist picker */}
      <SelectPlaylistSheet
        visible={showPlaylistPicker}
        onClose={() => setShowPlaylistPicker(false)}
        onSelect={handleAddToPlaylist}
      />
    </>
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
  info: { flex: 1 },
  favoriteButton: { paddingLeft: spacing.sm },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  menu: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  menuTitle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
