import { View, Text, StyleSheet } from "react-native";
import type { AudioQualityInfo, QualityLabel } from "@aura/types";
import { getQualityLabel } from "@aura/shared";
import { colors, spacing, radii, typography } from "../theme/tokens";

export { getQualityLabel };

function formatDetail(quality: AudioQualityInfo): string {
  if (quality.bitDepth && quality.sampleRateHz) {
    const khz = quality.sampleRateHz / 1000;
    const khzStr = Number.isInteger(khz) ? khz.toFixed(0) : khz.toFixed(1);
    return `${quality.format} · ${quality.bitDepth}-bit / ${khzStr} kHz`;
  }
  if (quality.bitrateKbps) {
    return `${quality.format} · ${quality.bitrateKbps} kbps`;
  }
  return quality.format;
}

const labelColor: Record<QualityLabel, string> = {
  "Hi-Res Lossless": colors.hiRes,
  Lossless: colors.lossless,
  Lossy: colors.lossy,
  Unknown: colors.textTertiary,
};

export function QualityBadge({ quality }: { quality: AudioQualityInfo }) {
  const label = getQualityLabel(quality);
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: labelColor[label] }]} />
      <View>
        <Text style={[typography.label, { color: labelColor[label] }]}>
          {label}
        </Text>
        <Text style={typography.caption}>{formatDetail(quality)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    alignSelf: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
