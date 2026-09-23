import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import {
  useEqualizerStore,
  EQ_FREQUENCIES,
  PresetName,
  EqBand,
} from "../store/equalizerStore";

interface EqualizerModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_LIST: PresetName[] = [
  "Flat",
  "Bass Boost",
  "Vocal Clarity",
  "Treble Boost",
  "Acoustic",
  "Electronic",
  "Rock",
];

export function EqualizerModal({ visible, onClose }: EqualizerModalProps) {
  const {
    bands,
    selectedPreset,
    bitPerfect,
    setBand,
    setPreset,
    setBitPerfect,
    resetEq,
  } = useEqualizerStore();

  const handleAdjustBand = (bandIndex: EqBand, delta: number) => {
    if (bitPerfect) return;
    const current = bands[bandIndex];
    setBand(bandIndex, current + delta);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Audiophile Equalizer</Text>
              <Text style={styles.subtitle}>5-Band Precision Parametric DSP</Text>
            </View>
            <Pressable onPress={onClose} style={styles.doneButton} testID="eq-close-btn">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          {/* Bit-Perfect Mode Toggle */}
          <View style={styles.bitPerfectCard}>
            <View style={styles.bitPerfectInfo}>
              <View style={styles.bitPerfectRow}>
                <Text style={styles.bitPerfectTitle}>Bit-Perfect Mode</Text>
                {bitPerfect && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>DSP BYPASSED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bitPerfectDesc}>
                Direct uncompressed audio transmission to DAC. Bypasses all EQ and system DSP.
              </Text>
            </View>
            <Pressable
              onPress={() => setBitPerfect(!bitPerfect)}
              style={[styles.toggleBtn, bitPerfect && styles.toggleBtnActive]}
              testID="eq-bit-perfect-toggle"
            >
              <Text style={[styles.toggleText, bitPerfect && styles.toggleTextActive]}>
                {bitPerfect ? "ON" : "OFF"}
              </Text>
            </Pressable>
          </View>

          {/* Preset Chips */}
          <View style={styles.presetSection}>
            <Text style={styles.sectionLabel}>Presets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
              {PRESET_LIST.map((preset) => {
                const isActive = selectedPreset === preset && !bitPerfect;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => !bitPerfect && setPreset(preset)}
                    disabled={bitPerfect}
                    style={[
                      styles.presetChip,
                      isActive && styles.presetChipActive,
                      bitPerfect && styles.presetChipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isActive && styles.presetChipTextActive,
                        bitPerfect && styles.presetChipTextDisabled,
                      ]}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 5-Band Slider Columns */}
          <View style={[styles.bandsContainer, bitPerfect && styles.bandsDisabled]}>
            {EQ_FREQUENCIES.map(({ band, label, sublabel }) => {
              const gain = bitPerfect ? 0 : bands[band];
              const gainStr = gain > 0 ? `+${gain}` : `${gain}`;

              return (
                <View key={band} style={styles.bandColumn}>
                  {/* Plus button */}
                  <Pressable
                    onPress={() => handleAdjustBand(band, 1)}
                    disabled={bitPerfect || gain >= 12}
                    style={[styles.adjustBtn, (bitPerfect || gain >= 12) && styles.adjustBtnDisabled]}
                  >
                    <Text style={styles.adjustBtnText}>+</Text>
                  </Pressable>

                  {/* Vertical Level Indicator */}
                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          height: `${Math.round(((gain + 12) / 24) * 100)}%`,
                          backgroundColor: bitPerfect
                            ? colors.textTertiary
                            : gain > 0
                            ? colors.accent
                            : colors.textSecondary,
                        },
                      ]}
                    />
                    <View style={styles.meterCenterLine} />
                  </View>

                  {/* Minus button */}
                  <Pressable
                    onPress={() => handleAdjustBand(band, -1)}
                    disabled={bitPerfect || gain <= -12}
                    style={[styles.adjustBtn, (bitPerfect || gain <= -12) && styles.adjustBtnDisabled]}
                  >
                    <Text style={styles.adjustBtnText}>-</Text>
                  </Pressable>

                  {/* Value */}
                  <Text style={[styles.gainLabel, bitPerfect && styles.textMuted]}>
                    {gainStr} dB
                  </Text>
                  <Text style={styles.freqLabel}>{label}</Text>
                  <Text style={styles.freqSublabel}>{sublabel}</Text>
                </View>
              );
            })}
          </View>

          {/* Bottom Reset */}
          {!bitPerfect && (
            <Pressable onPress={resetEq} style={styles.resetBtn} testID="eq-reset-btn">
              <Text style={styles.resetText}>Reset to Flat (0 dB)</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  doneButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneText: {
    ...typography.bodySecondary,
    color: colors.accent,
    fontWeight: "600",
  },
  bitPerfectCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  bitPerfectInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bitPerfectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 2,
  },
  bitPerfectTitle: {
    ...typography.bodyPrimary,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  activePill: {
    backgroundColor: "rgba(0, 229, 255, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  bitPerfectDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.background,
  },
  presetSection: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  presetRow: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  presetChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetChipDisabled: {
    opacity: 0.4,
  },
  presetChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: colors.background,
    fontWeight: "700",
  },
  presetChipTextDisabled: {
    color: colors.textTertiary,
  },
  bandsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bandsDisabled: {
    opacity: 0.4,
  },
  bandColumn: {
    alignItems: "center",
    flex: 1,
  },
  adjustBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 4,
  },
  adjustBtnDisabled: {
    opacity: 0.3,
  },
  adjustBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  meterTrack: {
    width: 8,
    height: 100,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    overflow: "hidden",
    justifyContent: "flex-end",
    position: "relative",
    marginVertical: 4,
  },
  meterFill: {
    width: "100%",
    borderRadius: radii.full,
  },
  meterCenterLine: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  gainLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.accent,
    marginTop: 4,
  },
  textMuted: {
    color: colors.textTertiary,
  },
  freqLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  freqSublabel: {
    fontSize: 9,
    color: colors.textTertiary,
  },
  resetBtn: {
    marginTop: spacing.md,
    alignSelf: "center",
  },
  resetText: {
    ...typography.caption,
    color: colors.textTertiary,
    textDecorationLine: "underline",
  },
});
