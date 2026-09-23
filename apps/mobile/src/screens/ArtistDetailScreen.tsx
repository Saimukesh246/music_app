import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Album, Track } from "@aura/types";
import { colors, spacing, typography } from "../theme/tokens";
import { useLibraryData } from "../hooks/useLibraryData";
import { usePlayerStore } from "../store/playerStore";
import { ArtworkCard } from "../components/ArtworkCard";
import { TrackRow } from "../components/TrackRow";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "ArtistDetail">;

export function ArtistDetailScreen({ route, navigation }: Props) {
  const { artistId } = route.params;
  const { tracks, albums } = useLibraryData();
  const playTrack = usePlayerStore((s) => s.playTrack);

  const artistTracks = tracks
    .filter((t) => t.artistId === artistId)
    .sort((a, b) => {
      if (a.albumId !== b.albumId) return a.albumTitle.localeCompare(b.albumTitle);
      return (a.quality as unknown as { trackNumber?: number }).trackNumber ?? 0 >
        (b.quality as unknown as { trackNumber?: number }).trackNumber ?? 0
        ? 1
        : -1;
    });

  const artistAlbums: Album[] = albums.filter((al) => al.artistId === artistId);
  const artistName = artistTracks[0]?.artistName ?? "Artist";

  return (
    <View style={styles.container}>
      {/* Back */}
      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Back"
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Artist name */}
        <Text style={[typography.title, styles.artistName]}>{artistName}</Text>
        <Text style={[typography.caption, styles.trackCount]}>
          {artistAlbums.length} album{artistAlbums.length !== 1 ? "s" : ""} ·{" "}
          {artistTracks.length} track{artistTracks.length !== 1 ? "s" : ""}
        </Text>

        {/* Albums row */}
        {artistAlbums.length > 0 && (
          <View style={styles.albumsSection}>
            <Text style={[typography.heading, styles.sectionTitle]}>Albums</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {artistAlbums.map((album) => (
                <ArtworkCard
                  key={album.id}
                  title={album.title}
                  artworkUrl={album.artworkUrl}
                  onPress={() => {
                    navigation.navigate("AlbumDetail", { albumId: album.id });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* All tracks */}
        <Text style={[typography.heading, styles.sectionTitle]}>All Tracks</Text>
        {artistTracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            onPress={() => playTrack(track, artistTracks)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: spacing.md, paddingTop: spacing.xl },
  backIcon: { fontSize: 28, color: colors.textSecondary },
  content: { paddingBottom: spacing.xxl },
  artistName: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  trackCount: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  albumsSection: { marginBottom: spacing.lg },
  sectionTitle: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
});
