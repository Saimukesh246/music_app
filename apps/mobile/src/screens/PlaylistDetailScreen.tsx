import { useState, useEffect, useCallback } from "react";
import {
  View, Text, Pressable, FlatList, StyleSheet, TextInput, Alert,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Track } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { getLibraryDb } from "../providers";
import { usePlaylistStore } from "../store/playlistStore";
import { usePlayerStore } from "../store/playerStore";
import { TrackRow } from "../components/TrackRow";
import { AddToPlaylistSheet } from "../components/AddToPlaylistSheet";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PlaylistDetail">;

export function PlaylistDetailScreen({ route, navigation }: Props) {
  const { playlistId } = route.params;
  const playlists = usePlaylistStore((s) => s.playlists);
  const renamePlaylist = usePlaylistStore((s) => s.renamePlaylist);
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((s) => s.removeTrackFromPlaylist);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const playlist = playlists.find((p) => p.id === playlistId);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(playlist?.title ?? "");
  const [showAddSheet, setShowAddSheet] = useState(false);

  const loadTracks = useCallback(() => {
    void getLibraryDb()
      .then((db) => db.getPlaylistTracks(playlistId))
      .then(setTracks);
  }, [playlistId]);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  function handlePlayAll() {
    if (tracks.length === 0) return;
    playTrack(tracks[0], tracks);
  }

  async function handleSaveTitle() {
    const title = draftTitle.trim();
    if (title && title !== playlist?.title) {
      await renamePlaylist(playlistId, title);
    }
    setEditingTitle(false);
  }

  function handleDeletePlaylist() {
    Alert.alert(
      "Delete Playlist",
      `Delete "${playlist?.title ?? "this playlist"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: () => {
            void deletePlaylist(playlistId).then(() => navigation.goBack());
          },
        },
      ]
    );
  }

  async function handleRemoveTrack(trackId: string) {
    await removeTrackFromPlaylist(playlistId, trackId);
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <Text style={styles.backBtn}>‹</Text>
        </Pressable>

        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void handleSaveTitle()}
            onBlur={() => void handleSaveTitle()}
          />
        ) : (
          <Pressable
            onLongPress={() => { setDraftTitle(playlist?.title ?? ""); setEditingTitle(true); }}
            accessibilityLabel="Long press to rename"
          >
            <Text style={typography.title} numberOfLines={1}>
              {playlist?.title ?? "Playlist"}
            </Text>
          </Pressable>
        )}

        <Pressable onPress={handleDeletePlaylist} hitSlop={8} accessibilityLabel="Delete playlist">
          <Text style={styles.deleteBtn}>✕</Text>
        </Pressable>
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <Pressable
          style={styles.playAllBtn}
          onPress={handlePlayAll}
          disabled={tracks.length === 0}
          testID="play-all-btn"
        >
          <Text style={[typography.label, { color: colors.accent }]}>▶ PLAY ALL</Text>
        </Pressable>
        <Pressable
          style={styles.addBtn}
          onPress={() => setShowAddSheet(true)}
          testID="add-tracks-btn"
        >
          <Text style={[typography.label, { color: colors.textSecondary }]}>＋ ADD TRACKS</Text>
        </Pressable>
      </View>

      {/* Track list */}
      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            Tap "+ ADD TRACKS" to build this playlist.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <View style={styles.trackRowWrapper}>
              <TrackRow
                track={item}
                onPress={() => playTrack(item, tracks)}
              />
              <Pressable
                onPress={() => void handleRemoveTrack(item.id)}
                hitSlop={8}
                style={styles.removeBtn}
                accessibilityLabel={`Remove ${item.title}`}
              >
                <Text style={styles.removeIcon}>×</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Add tracks sheet */}
      <AddToPlaylistSheet
        visible={showAddSheet}
        playlistId={playlistId}
        onClose={() => { setShowAddSheet(false); loadTracks(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { fontSize: 28, color: colors.textSecondary, lineHeight: 30 },
  titleInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: spacing.xs,
  },
  deleteBtn: { fontSize: 18, color: colors.textTertiary },
  actionBar: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  playAllBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackRowWrapper: { flexDirection: "row", alignItems: "center" },
  removeBtn: { paddingRight: spacing.md, paddingLeft: spacing.xs },
  removeIcon: { fontSize: 20, color: colors.textTertiary },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
});
