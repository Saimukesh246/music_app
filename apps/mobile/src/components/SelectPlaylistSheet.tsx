import { useState } from "react";
import {
  Modal, View, Text, FlatList, Pressable, TextInput, StyleSheet,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlaylistStore } from "../store/playlistStore";

interface SelectPlaylistSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called when the user picks a playlist to add the track to. */
  onSelect: (playlistId: string) => void;
}

export function SelectPlaylistSheet({ visible, onClose, onSelect }: SelectPlaylistSheetProps) {
  const playlists = usePlaylistStore((s) => s.playlists);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    const id = await createPlaylist(title);
    setNewTitle("");
    setCreating(false);
    onSelect(id);
    onClose();
  }

  function handleSelect(id: string) {
    onSelect(id);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="select-playlist-modal"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={typography.heading}>Add to Playlist</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        {/* New playlist row */}
        {creating ? (
          <View style={styles.newRow}>
            <TextInput
              style={styles.newInput}
              placeholder="Playlist name"
              placeholderTextColor={colors.textTertiary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreate()}
            />
            <Pressable onPress={() => void handleCreate()} style={styles.createBtn}>
              <Text style={[typography.label, { color: colors.accent }]}>CREATE</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCreating(true)}
            style={styles.newPlaylistRow}
            testID="new-playlist-btn"
          >
            <Text style={[typography.body, { color: colors.accent }]}>＋ New Playlist</Text>
          </Pressable>
        )}

        {/* Existing playlists */}
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleSelect(item.id)}
              testID={`playlist-row-${item.id}`}
            >
              <Text style={typography.body}>{item.title}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={[typography.caption, styles.empty]}>No playlists yet</Text>
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
  closeIcon: { fontSize: 18, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  newPlaylistRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newInput: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
  },
  createBtn: { paddingHorizontal: spacing.sm },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  empty: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, color: colors.textTertiary },
});
