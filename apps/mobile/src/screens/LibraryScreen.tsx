import { useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, ScrollView, Alert,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Artist } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { TrackRow } from "../components/TrackRow";
import { ArtworkCard } from "../components/ArtworkCard";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlaylistStore } from "../store/playlistStore";
import { useDownloadStore } from "../store/downloadStore";
import type { RootStackParamList } from "../navigation/RootNavigator";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type Segment = "Artists" | "Albums" | "Tracks" | "Playlists" | "Downloaded";
const SEGMENTS: Segment[] = ["Artists", "Albums", "Tracks", "Playlists", "Downloaded"];

// ---------------------------------------------------------------------------
// Artists segment
// ---------------------------------------------------------------------------

function ArtistsTab() {
  const { tracks } = useLibraryData();
  const navigation = useNavigation<NavProp>();
  const playTrack = usePlayerStore((s) => s.playTrack);

  // Collect unique artists from tracks
  const artistMap = new Map<string, Artist & { trackCount: number }>();
  for (const t of tracks) {
    if (!artistMap.has(t.artistId)) {
      artistMap.set(t.artistId, {
        id: t.artistId,
        name: t.artistName,
        trackCount: 0,
      });
    }
    artistMap.get(t.artistId)!.trackCount += 1;
  }
  const artists = [...artistMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (artists.length === 0) {
    return <EmptyState message="No artists in your library yet." />;
  }

  return (
    <FlatList
      data={artists}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => (
        <Pressable
          style={styles.listRow}
          onPress={() => navigation.navigate("ArtistDetail", { artistId: item.id })}
          testID={`artist-row-${item.id}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={typography.body}>{item.name}</Text>
            <Text style={typography.caption}>{item.trackCount} tracks</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Albums segment
// ---------------------------------------------------------------------------

function AlbumsTab() {
  const { albums } = useLibraryData();
  const navigation = useNavigation<NavProp>();

  const sorted = [...albums].sort((a, b) => {
    const artistCmp = a.artistName.localeCompare(b.artistName);
    return artistCmp !== 0 ? artistCmp : a.title.localeCompare(b.title);
  });

  if (sorted.length === 0) {
    return <EmptyState message="No albums in your library yet." />;
  }

  return (
    <ScrollView contentContainerStyle={styles.albumGrid}>
      {sorted.map((album) => (
        <ArtworkCard
          key={album.id}
          title={album.title}
          subtitle={album.artistName}
          artworkUrl={album.artworkUrl}
          onPress={() => {
            navigation.navigate("AlbumDetail", { albumId: album.id });
          }}
        />
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Tracks segment
// ---------------------------------------------------------------------------

function TracksTab() {
  const { tracks } = useLibraryData();
  const playTrack = usePlayerStore((s) => s.playTrack);

  if (tracks.length === 0) {
    return <EmptyState message="No tracks yet. Scan a folder in Settings." />;
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TrackRow track={item} onPress={() => playTrack(item, tracks)} />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Playlists segment
// ---------------------------------------------------------------------------

function PlaylistsTab() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const navigation = useNavigation<NavProp>();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) { setCreating(false); return; }
    const id = await createPlaylist(title);
    setNewTitle("");
    setCreating(false);
    navigation.navigate("PlaylistDetail", { playlistId: id });
  }

  return (
    <View style={{ flex: 1 }}>
      {/* New playlist input */}
      {creating ? (
        <View style={styles.newPlaylistRow}>
          <TextInput
            style={styles.newPlaylistInput}
            placeholder="Playlist name"
            placeholderTextColor={colors.textTertiary}
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void handleCreate()}
          />
          <Pressable onPress={() => void handleCreate()}>
            <Text style={[typography.label, { color: colors.accent }]}>CREATE</Text>
          </Pressable>
          <Pressable onPress={() => { setCreating(false); setNewTitle(""); }}>
            <Text style={[typography.label, { color: colors.textTertiary }]}>CANCEL</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.newPlaylistBtn}
          onPress={() => setCreating(true)}
          testID="create-playlist-btn"
        >
          <Text style={[typography.body, { color: colors.accent }]}>＋ New Playlist</Text>
        </Pressable>
      )}

      {playlists.length === 0 && !creating ? (
        <EmptyState message="No playlists yet. Tap '+ New Playlist' to create one." />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.listRow}
              onPress={() => navigation.navigate("PlaylistDetail", { playlistId: item.id })}
              testID={`playlist-row-${item.id}`}
            >
              <Text style={[typography.body, { flex: 1 }]}>{item.title}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Downloaded segment
// ---------------------------------------------------------------------------

function DownloadedTab() {
  const { tracks } = useLibraryData();
  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);
  const playTrack = usePlayerStore((s) => s.playTrack);

  const downloadedList = tracks.filter((t) => downloadedTracks.has(t.id));

  if (downloadedList.length === 0) {
    return (
      <EmptyState message="No downloaded tracks yet. Tap ⬇ DL while playing any track to save for offline listening." />
    );
  }

  return (
    <FlatList
      data={downloadedList}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <TrackRow
          track={item}
          onPress={() => playTrack(item, downloadedList)}
          testID={`downloaded-track-${item.id}`}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state helper
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={[typography.caption, { color: colors.textTertiary }]}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// LibraryScreen
// ---------------------------------------------------------------------------

export function LibraryScreen() {
  const [activeSegment, setActiveSegment] = useState<Segment>("Artists");

  return (
    <View style={styles.container}>
      <Text style={[typography.title, styles.title]}>Your Library</Text>

      {/* Segment control */}
      <View style={styles.segmentBar}>
        {SEGMENTS.map((seg) => (
          <Pressable
            key={seg}
            style={[styles.segment, activeSegment === seg && styles.segmentActive]}
            onPress={() => setActiveSegment(seg)}
            testID={`segment-${seg}`}
          >
            <Text
              style={[
                typography.label,
                activeSegment === seg
                  ? { color: colors.accent }
                  : { color: colors.textTertiary },
              ]}
            >
              {seg.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeSegment === "Artists"    && <ArtistsTab />}
        {activeSegment === "Albums"     && <AlbumsTab />}
        {activeSegment === "Tracks"     && <TracksTab />}
        {activeSegment === "Playlists"  && <PlaylistsTab />}
        {activeSegment === "Downloaded" && <DownloadedTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { paddingHorizontal: spacing.md, paddingTop: spacing.xl, marginBottom: spacing.md },
  segmentBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  segmentActive: {
    borderBottomColor: colors.accent,
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chevron: { fontSize: 20, color: colors.textTertiary },
  newPlaylistBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newPlaylistInput: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
});
