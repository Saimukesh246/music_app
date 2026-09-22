import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { Album, Track } from "@aura/types";
import { recommendTracks } from "@aura/shared";
import { colors, spacing, typography } from "../theme/tokens";
import { ArtworkCard } from "../components/ArtworkCard";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useLibraryData } from "../hooks/useLibraryData";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Section({
  title,
  albums: sectionAlbums,
  tracks,
}: {
  title: string;
  albums: Album[];
  tracks: Track[];
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  if (sectionAlbums.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[typography.heading, styles.sectionTitle]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {sectionAlbums.map((album) => (
          <ArtworkCard
            key={album.id}
            title={album.title}
            subtitle={album.artistName}
            onPress={() => {
              const albumTracks = tracks.filter((t) => t.albumId === album.id);
              if (albumTracks.length > 0) playTrack(albumTracks[0], albumTracks);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function albumsFromTracks(recommendedTracks: Track[], allAlbums: Album[]): Album[] {
  const albumById = new Map(allAlbums.map((album) => [album.id, album]));
  const seen = new Set<string>();
  const result: Album[] = [];
  for (const track of recommendedTracks) {
    if (seen.has(track.albumId)) continue;
    const album = albumById.get(track.albumId);
    if (album) {
      seen.add(track.albumId);
      result.push(album);
    }
  }
  return result;
}

export function HomeScreen() {
  const { tracks, albums, loading } = useLibraryData();
  const favoriteTrackIds = useLibraryStore((s) => s.favoriteTrackIds);

  const hiRes = albums.filter((album) =>
    tracks.some(
      (t) =>
        t.albumId === album.id &&
        (t.quality.bitDepth ?? 0) > 16 &&
        t.quality.format === "FLAC"
    )
  );

  const favoriteTracks = tracks.filter((t) => favoriteTrackIds.has(t.id));
  const recommended = albumsFromTracks(recommendTracks(tracks, favoriteTracks, 10), albums);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.title, styles.greeting]}>{greeting()}</Text>
      {!loading && albums.length === 0 ? (
        <Text style={[typography.caption, styles.greeting]}>
          Your library is empty. Add music from Settings › Scan Music Folder.
        </Text>
      ) : null}
      <Section title="Recently Added" albums={[...albums].reverse()} tracks={tracks} />
      <Section title="Hi-Res Collection" albums={hiRes} tracks={tracks} />
      <Section title="Your Heavy Rotation" albums={albums} tracks={tracks} />
      <Section title="Recommended For You" albums={recommended} tracks={tracks} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  greeting: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});
