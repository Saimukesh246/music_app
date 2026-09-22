import { useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { LyricLine } from "@aura/shared";
import { colors, spacing, radii, typography } from "../theme/tokens";
import type { LyricsStatus } from "../hooks/useLyrics";

interface LyricsViewProps {
  status: LyricsStatus;
  plainLyrics?: string;
  syncedLines?: LyricLine[];
  positionSec: number;
}

const LINE_HEIGHT = 28;

function findActiveIndex(lines: LyricLine[], positionSec: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec <= positionSec) index = i;
    else break;
  }
  return index;
}

export function LyricsView({ status, plainLyrics, syncedLines, positionSec }: LyricsViewProps) {
  const scrollRef = useRef<ScrollView>(null);

  const activeIndex = useMemo(
    () => (syncedLines ? findActiveIndex(syncedLines, positionSec) : -1),
    [syncedLines, positionSec]
  );

  useEffect(() => {
    if (activeIndex < 0) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, activeIndex * LINE_HEIGHT - LINE_HEIGHT * 3),
      animated: true,
    });
  }, [activeIndex]);

  if (status === "loading") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Loading lyrics…</Text>
      </View>
    );
  }

  if (status === "instrumental") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Instrumental — no lyrics</Text>
      </View>
    );
  }

  if (status === "unavailable") {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={typography.caption}>Lyrics unavailable</Text>
      </View>
    );
  }

  if (syncedLines && syncedLines.length > 0) {
    return (
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.padded}>
        {syncedLines.map((line, index) => (
          <Text
            key={`${line.timeSec}-${index}`}
            style={[
              typography.body,
              styles.syncedLine,
              index === activeIndex && { color: colors.accent },
            ]}
          >
            {line.text || " "}
          </Text>
        ))}
      </ScrollView>
    );
  }

  if (plainLyrics) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.padded}>
        <Text style={typography.body}>{plainLyrics}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.centered]}>
      <Text style={typography.caption}>Lyrics unavailable</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  padded: {
    padding: spacing.md,
  },
  syncedLine: {
    lineHeight: LINE_HEIGHT,
    color: colors.textSecondary,
  },
});
