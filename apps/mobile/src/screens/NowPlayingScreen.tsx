import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Image, Modal } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { usePlayerStore } from "../store/playerStore";
import { useLibraryStore } from "../store/libraryStore";
import { useDownloadStore } from "../store/downloadStore";
import { QualityBadge } from "../components/QualityBadge";
import { SeekBar } from "../components/SeekBar";
import { QueueSheet } from "../components/QueueSheet";
import { EqualizerModal } from "../components/EqualizerModal";
import { DacInspector } from "../components/DacInspector";
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

const SLEEP_OPTIONS = [
  { label: "15 minutes", val: 15 },
  { label: "30 minutes", val: 30 },
  { label: "45 minutes", val: 45 },
  { label: "60 minutes", val: 60 },
  { label: "End of current track", val: -1 },
  { label: "Off (Cancel Timer)", val: null },
];

export function NowPlayingScreen({ navigation }: Props) {
  const currentTrack     = usePlayerStore((s) => s.currentTrack);
  const isPlaying        = usePlayerStore((s) => s.isPlaying);
  const positionSec      = usePlayerStore((s) => s.positionSec);
  const repeatMode       = usePlayerStore((s) => s.repeatMode);
  const shuffleEnabled   = usePlayerStore((s) => s.shuffleEnabled);
  const sleepTimerMinutes = usePlayerStore((s) => s.sleepTimerMinutes);
  const sleepTimerSec    = usePlayerStore((s) => s.sleepTimerRemainingSec);
  const setSleepTimer    = usePlayerStore((s) => s.setSleepTimer);
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

  const isDownloaded    = useDownloadStore((s) =>
    currentTrack ? s.isDownloaded(currentTrack.id) : false
  );
  const downloadTrack   = useDownloadStore((s) => s.downloadTrack);
  const deleteDownload  = useDownloadStore((s) => s.deleteDownload);
  const downloadProgress = useDownloadStore((s) =>
    currentTrack ? s.getDownloadProgress(currentTrack.id) : undefined
  );

  const [showLyrics, setShowLyrics]         = useState(false);
  const [showQueue, setShowQueue]           = useState(false);
  const [showEq, setShowEq]                 = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
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

  function handleToggleDownload() {
    if (!currentTrack) return;
    if (isDownloaded) {
      void deleteDownload(currentTrack.id);
    } else {
      void downloadTrack(currentTrack);
    }
  }

  return (
    <View style={styles.container}>
      {/* ── Background tint from artwork ── */}
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
        <DacInspector quality={currentTrack.quality} compact />
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setShowEq(true)}
            accessibilityLabel="Open Equalizer"
            testID="open-eq-btn"
          >
            <Text style={[typography.caption, styles.headerBtn]}>EQ</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowQueue(true)}
            accessibilityLabel="Open queue"
            testID="open-queue-btn"
          >
            <Text style={[typography.caption, styles.headerBtn]}>Queue</Text>
          </Pressable>
        </View>
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
        <View style={styles.artistAlbumRow}>
          <Pressable
            onPress={() =>
              navigation.navigate("ArtistDetail", { artistId: currentTrack.artistId })
            }
            hitSlop={8}
            accessibilityLabel={`View artist ${currentTrack.artistName}`}
          >
            <Text
              style={[typography.body, styles.clickableMetaText]}
              numberOfLines={1}
            >
              {currentTrack.artistName}
            </Text>
          </Pressable>
          <Text style={[typography.body, { color: colors.textTertiary }]}> · </Text>
          <Pressable
            onPress={() =>
              navigation.navigate("AlbumDetail", { albumId: currentTrack.albumId })
            }
            hitSlop={8}
            accessibilityLabel={`View album ${currentTrack.albumTitle}`}
          >
            <Text
              style={[typography.body, styles.clickableMetaText]}
              numberOfLines={1}
            >
              {currentTrack.albumTitle}
            </Text>
          </Pressable>
        </View>
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

      {/* ── Action bar: Favorite, Offline Download, Sleep Timer ── */}
      <View style={styles.actionBar}>
        <Pressable
          onPress={() => toggleFavorite(currentTrack.id)}
          accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
          style={styles.actionBtn}
        >
          <Text style={{ color: isFavorite ? colors.accent : colors.textTertiary, fontSize: 20 }}>
            {isFavorite ? "♥" : "♡"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleToggleDownload}
          accessibilityLabel={isDownloaded ? "Remove download" : "Download track"}
          style={styles.actionBtn}
          testID="nowplaying-download-btn"
        >
          <Text
            style={{
              color: isDownloaded ? colors.accent : colors.textTertiary,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            {downloadProgress !== undefined
              ? `${downloadProgress}%`
              : isDownloaded
              ? "✓ DL"
              : "⬇ DL"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setShowSleepSheet(true)}
          accessibilityLabel="Sleep Timer"
          style={styles.actionBtn}
          testID="sleep-timer-btn"
        >
          <Text
            style={{
              color: sleepTimerMinutes !== null ? colors.accent : colors.textTertiary,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            ⏱{" "}
            {sleepTimerMinutes === -1
              ? "End Track"
              : sleepTimerSec !== null
              ? `${Math.ceil(sleepTimerSec / 60)}m`
              : "Timer"}
          </Text>
        </Pressable>
      </View>

      {/* ── Queue sheet ── */}
      <QueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />

      {/* ── Equalizer modal ── */}
      <EqualizerModal visible={showEq} onClose={() => setShowEq(false)} />

      {/* ── Sleep Timer Sheet ── */}
      <Modal visible={showSleepSheet} transparent animationType="slide">
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Sleep Timer</Text>
            <Text style={styles.sheetSub}>
              Automatically pauses playback when the timer finishes.
            </Text>
            {SLEEP_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                onPress={() => {
                  setSleepTimer(opt.val);
                  setShowSleepSheet(false);
                }}
                style={styles.sheetOption}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    sleepTimerMinutes === opt.val && { color: colors.accent, fontWeight: "700" },
                  ]}
                >
                  {opt.label}
                </Text>
                {sleepTimerMinutes === opt.val && <Text style={styles.sheetCheck}>✓</Text>}
              </Pressable>
            ))}
            <Pressable onPress={() => setShowSleepSheet(false)} style={styles.sheetClose}>
              <Text style={styles.sheetCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.xxl,
    justifyContent: "space-between",
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  headerBtn: {
    color: colors.textSecondary,
  },
  artworkSlot: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  artworkImage: {
    width: "100%",
    height: "100%",
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceElevated,
  },
  meta: {
    alignItems: "center",
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  lyricsToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  seekRow: {
    width: "100%",
    paddingVertical: spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: -spacing.xs,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
  },
  controlIcon: {
    color: colors.textPrimary,
    fontSize: 24,
  },
  playPauseIcon: {
    color: colors.textPrimary,
    fontSize: 40,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheetBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  sheetSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  sheetOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  sheetCheck: {
    color: colors.accent,
    fontWeight: "700",
  },
  sheetClose: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  sheetCloseText: {
    ...typography.bodySecondary,
    color: colors.textTertiary,
  },
  artistAlbumRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  clickableMetaText: {
    color: colors.textSecondary,
    textDecorationLine: "underline",
    textDecorationColor: "#444",
  },
});
