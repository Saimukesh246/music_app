import { useState } from "react";
import {
  Modal, View, Text, FlatList, Pressable, TextInput, StyleSheet,
} from "react-native";
import type { Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlaylistStore } from "../store/playlistStore";
import { getQualityLabel } from "./QualityBadge";

interface AddToPlaylistSheetProps {
  visible: boolean;
  playlistId: string;
  onClose: () => void;
}

export function AddToPlaylistSheet({ visible, playlistId, onClose }: AddToPlaylistSheetProps) {
  const { tracks } = useLibraryData();
  const addTrackToPlaylist = usePlaylistStore((s) => s.addTrackToPlaylist);
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  const filtered = query.trim()
    ? tracks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artistName.toLowerCase().includes(query.toLowerCase())
      )
    : tracks;

  function handleAdd(track: Track) {
    void addTrackToPlaylist(playlistId, track.id);
    setAdded((prev) => new Set(prev).add(track.id));
  }

  function handleClose() {
    setQuery("");
    setAdded(new Set());
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      testID="add-to-playlist-modal"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={typography.heading}>Add Tracks</Text>
          <Pressable onPress={handleClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={styles.closeIcon}>Done</Text>
          </Pressable>
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or artist"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
        />

        {/* Track list */}
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => {
            const isAdded = added.has(item.id);
            return (
              <Pressable
                style={styles.row}
                onPress={() => handleAdd(item)}
                disabled={isAdded}
                testID={`add-track-${item.id}`}
              >
                <View style={styles.trackInfo}>
                  <Text style={typography.body} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.artistName} · {getQualityLabel(item.quality)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.addIcon,
                    isAdded && { color: colors.accent },
                  ]}
                >
                  {isAdded ? "✓" : "＋"}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No tracks found</Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  closeIcon: { fontSize: 15, color: colors.accent },
  searchInput: {
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  trackInfo: { flex: 1 },
  addIcon: { fontSize: 20, color: colors.textSecondary, width: 24, textAlign: "center" },
  empty: { ...typography.caption, padding: spacing.lg, color: colors.textTertiary },
});
