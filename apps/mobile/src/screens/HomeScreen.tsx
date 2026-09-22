import { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import type { Album } from "@aura/types";
import { colors, spacing, typography } from "../theme/tokens";
import { ArtworkCard } from "../components/ArtworkCard";
import { provider } from "../providers";
import { albums, tracks } from "@aura/shared";
import { usePlayerStore } from "../store/playerStore";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Section({ title, albums: sectionAlbums }: { title: string; albums: Album[] }) {
  const playTrack = usePlayerStore((s) => s.playTrack);

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
              const firstTrack = tracks.find((t) => t.albumId === album.id);
              if (firstTrack) {
                const albumTracks = tracks.filter((t) => t.albumId === album.id);
                playTrack(firstTrack, albumTracks);
              }
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function HomeScreen() {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Album[]>([]);

  useEffect(() => {
    void provider.search("").then(() => setRecentlyPlayed(albums));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.title, styles.greeting]}>{greeting()}</Text>
      <Section title="Recently Played" albums={recentlyPlayed} />
      <Section title="Made For You" albums={albums.slice(0, 2)} />
      <Section title="Your Heavy Rotation" albums={albums.slice(1, 3)} />
      <Section title="Hi-Res Collection" albums={albums.filter((a) => a.id !== "album-2")} />
      <Section title="Recently Added" albums={[...albums].reverse()} />
      <Section title="Recommended For You" albums={albums} />
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
