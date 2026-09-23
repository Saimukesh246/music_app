import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { QualityBadge } from "../components/QualityBadge";
import { SeekBar } from "../components/SeekBar";
import { QueueSheet } from "../components/QueueSheet";
import { useLyrics } from "../hooks/useLyrics";
import { LyricsView } from "../components/LyricsView";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "NowPlaying">;

const REPEAT_LABEL: Record<string, string> = {
  off: "⟲",
  all: "⟲ ALL",
  one: "⟲ ONE",
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function NowPlayingScreen({ navigation }: Props) {
  const currentTrack  = usePlayerStore((s) => s.currentTrack);
  const isPlaying     = usePlayerStore((s) => s.isPlaying);
  const positionSec   = usePlayerStore((s) => s.positionSec);
  const repeatMode    = usePlayerStore((s) => s.repeatMode);
  const shuffleEnabled = usePlayerStore((s) => s.shuffleEnabled);
  const togglePlayPause  = usePlayerStore((s) => s.togglePlayPause);
  const playNext         = usePlayerStore((s) => s.playNext);
  const playPrevious     = usePlayerStore((s) => s.playPrevious);
  const cycleRepeatMode  = usePlayerStore((s) => s.cycleRepeatMode);
  const toggleShuffle    = usePlayerStore((s) => s.toggleShuffle);
  const seekTo           = usePlayerStore((s) => s.seekTo);

  const isFavorite     = useLibraryStore((s) =>
    currentTrack ? s.isFavorite(currentTrack.id) : false
  );
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue]   = useState(false);
  const lyrics = useLyrics(currentTrack);

  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={typography.body}>Nothing playing</Text>
      </View>
    );
  }

  const durationSec = currentTrack.quality.durationSec || 1;
  const progress    = Math.min(1, positionSec / durationSec);

  function handleSeek(ratio: number) {
    void seekTo(ratio * durationSec);
  }

  return (
    <View style={styles.container}>
      {/* ── Background tint from artwork (low-opacity blur stand-in) ── */}
      {currentTrack.artworkUrl ? (
        <Image
          source={{ uri: currentTrack.artworkUrl }}
          style={styles.bgTint}
          blurRadius={40}
          resizeMode="cover"
          accessibilityElementsHidden
        />
      ) : null}

      {/* ── Header row ── */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Close">
          <Text style={[typography.caption, styles.headerBtn]}>Close</Text>
        </Pressable>
        <Text style={[typography.label, { color: colors.textTertiary }]}>NOW PLAYING</Text>
        <Pressable
          onPress={() => setShowQueue(true)}
          accessibilityLabel="Open queue"
          testID="open-queue-btn"
        >
          <Text style={[typography.caption, styles.headerBtn]}>Queue</Text>
        </Pressable>
      </View>

      {/* ── Artwork / Lyrics panel ── */}
      <View style={styles.artworkSlot}>
        {showLyrics ? (
          <LyricsView
            status={lyrics.status}
            plainLyrics={lyrics.plainLyrics}
            syncedLines={lyrics.syncedLines}
            positionSec={positionSec}
          />
        ) : currentTrack.artworkUrl ? (
          <Image
            source={{ uri: currentTrack.artworkUrl }}
            style={styles.artworkImage}
            resizeMode="cover"
            accessibilityLabel={`Artwork for ${currentTrack.title}`}
          />
        ) : (
          <View style={styles.artworkPlaceholder} />
        )}
      </View>

      {/* ── Track meta + quality ── */}
      <View style={styles.meta}>
        <Text style={typography.title} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={typography.body} numberOfLines={1}>
          {currentTrack.artistName} — {currentTrack.albumTitle}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <QualityBadge quality={currentTrack.quality} />
        <Pressable
          onPress={() => setShowLyrics((v) => !v)}
          style={styles.lyricsToggle}
          accessibilityLabel={showLyrics ? "Show artwork" : "Show lyrics"}
        >
          <Text style={[typography.label, showLyrics && { color: colors.accent }]}>
            {showLyrics ? "ARTWORK" : "LYRICS"}
          </Text>
        </Pressable>
      </View>

      {/* ── SeekBar scrubber ── */}
      <View style={styles.seekRow}>
        <SeekBar progress={progress} onSeek={handleSeek} />
      </View>
      <View style={styles.timeRow}>
        <Text style={typography.caption}>{formatTime(positionSec)}</Text>
        <Text style={typography.caption}>{formatTime(durationSec)}</Text>
      </View>

      {/* ── Transport controls ── */}
      <View style={styles.controls}>
        {/* Shuffle */}
        <Pressable
          onPress={toggleShuffle}
          accessibilityLabel="Toggle shuffle"
          testID="shuffle-btn"
        >
          <Text
            style={[styles.controlIcon, shuffleEnabled && { color: colors.accent }]}
          >
            ⇄
          </Text>
        </Pressable>

        <Pressable onPress={playPrevious} accessibilityLabel="Previous track">
          <Text style={styles.controlIcon}>⏮</Text>
        </Pressable>

        <Pressable onPress={togglePlayPause} accessibilityLabel={isPlaying ? "Pause" : "Play"}>
          <Text style={styles.playPauseIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
        </Pressable>

        <Pressable onPress={playNext} accessibilityLabel="Next track">
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>

        {/* Repeat */}
        <Pressable onPress={cycleRepeatMode} accessibilityLabel="Cycle repeat mode">
          <Text
            style={[styles.controlIcon, repeatMode !== "off" && { color: colors.accent }]}
          >
            {REPEAT_LABEL[repeatMode]}
          </Text>
        </Pressable>
      </View>

      {/* ── Favorite ── */}
      <Pressable
        onPress={() => toggleFavorite(currentTrack.id)}
        accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Text style={{ color: isFavorite ? colors.accent : colors.textTertiary, fontSize: 22 }}>
          {isFavorite ? "♥" : "♡"}
        </Text>
      </Pressable>

      {/* ── Queue sheet ── */}
      <QueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />
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
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  headerRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerBtn: {
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  artworkSlot: {
    marginBottom: spacing.lg,
  },
  artworkImage: {
    width: 280,
    height: 280,
    borderRadius: radii.lg,
  },
  artworkPlaceholder: {
    width: 280,
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
  },
  meta: {
    alignItems: "center",
    marginBottom: spacing.sm,
    width: "100%",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lyricsToggle: {
    paddingVertical: spacing.xs,
  },
  seekRow: {
    width: "100%",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
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
