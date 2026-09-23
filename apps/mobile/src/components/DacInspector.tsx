import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import type { AudioQualityInfo } from "@aura/types";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { useEqualizerStore } from "../store/equalizerStore";

export type OutputRoute = "speaker" | "headphones" | "bluetooth" | "dac";

interface DacInspectorProps {
  quality?: AudioQualityInfo;
  compact?: boolean;
}

export function DacInspector({ quality, compact = false }: DacInspectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<OutputRoute>("headphones");
  const { bitPerfect, selectedPreset } = useEqualizerStore();

  const routeNames: Record<OutputRoute, { label: string; icon: string; detail: string }> = {
    dac: {
      label: "External USB DAC",
      icon: "⚡",
      detail: "Direct Bit-Perfect Hardware Rendering (up to 32-bit / 384 kHz)",
    },
    headphones: {
      label: "Wired Headphones / AUX",
      icon: "🎧",
      detail: "High-Impedance Analog Output (Direct Stereo Passthrough)",
    },
    bluetooth: {
      label: "Bluetooth LDAC / aptX HD",
      icon: "📶",
      detail: "High-Resolution Wireless Transmission (990 kbps / 24-bit / 96 kHz)",
    },
    speaker: {
      label: "Built-in Device Speaker",
      icon: "🔊",
      detail: "Internal System Speaker (Hardware Limiter Active)",
    },
  };

  const activeRoute = routeNames[selectedRoute];

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[styles.badge, compact && styles.badgeCompact]}
        testID="dac-inspector-trigger"
      >
        <Text style={styles.badgeIcon}>{activeRoute.icon}</Text>
        <Text style={styles.badgeText} numberOfLines={1}>
          {bitPerfect ? "BIT-PERFECT DAC" : activeRoute.label}
        </Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Signal Chain & DAC Inspector</Text>
                <Text style={styles.modalSubtitle}>Audiophile Hardware Output</Text>
              </View>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>

            {/* Signal Path Flow */}
            <View style={styles.signalChain}>
              {/* Step 1: Source */}
              <View style={styles.chainNode}>
                <Text style={styles.chainStepLabel}>1. SOURCE</Text>
                <Text style={styles.chainNodeTitle}>
                  {quality?.format || "LOSSLESS"}
                </Text>
                <Text style={styles.chainNodeSub}>
                  {quality?.bitDepth ? `${quality.bitDepth}-bit / ` : ""}
                  {quality?.sampleRateHz ? `${Math.round(quality.sampleRateHz / 1000)} kHz` : "Direct Stream"}
                </Text>
              </View>

              <Text style={styles.chainArrow}>➔</Text>

              {/* Step 2: DSP Processing */}
              <View style={styles.chainNode}>
                <Text style={styles.chainStepLabel}>2. PROCESSING</Text>
                <Text style={[styles.chainNodeTitle, bitPerfect && styles.cyanText]}>
                  {bitPerfect ? "BIT-PERFECT" : selectedPreset}
                </Text>
                <Text style={styles.chainNodeSub}>
                  {bitPerfect ? "DSP Bypassed" : "5-Band EQ Active"}
                </Text>
              </View>

              <Text style={styles.chainArrow}>➔</Text>

              {/* Step 3: Hardware Output */}
              <View style={styles.chainNode}>
                <Text style={styles.chainStepLabel}>3. OUTPUT</Text>
                <Text style={styles.chainNodeTitle} numberOfLines={1}>
                  {activeRoute.label}
                </Text>
                <Text style={styles.chainNodeSub}>Direct Render</Text>
              </View>
            </View>

            {/* Output Route Selector */}
            <Text style={styles.selectorHeading}>Active Output Route</Text>
            <View style={styles.routeList}>
              {(Object.keys(routeNames) as OutputRoute[]).map((key) => {
                const item = routeNames[key];
                const isSelected = selectedRoute === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedRoute(key)}
                    style={[styles.routeItem, isSelected && styles.routeItemActive]}
                  >
                    <Text style={styles.routeIcon}>{item.icon}</Text>
                    <View style={styles.routeTextCol}>
                      <Text style={[styles.routeTitle, isSelected && styles.routeTitleActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.routeDetail}>{item.detail}</Text>
                    </View>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 229, 255, 0.08)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(0, 229, 255, 0.25)",
    gap: 4,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeIcon: {
    fontSize: 11,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  modalCloseBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCloseText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  signalChain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  chainNode: {
    flex: 1,
    alignItems: "center",
  },
  chainStepLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  chainNodeTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  cyanText: {
    color: colors.accent,
  },
  chainNodeSub: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  chainArrow: {
    color: colors.textTertiary,
    fontSize: 14,
    marginHorizontal: 4,
  },
  selectorHeading: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  routeList: {
    gap: spacing.xs,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeItemActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(0, 229, 255, 0.05)",
  },
  routeIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  routeTextCol: {
    flex: 1,
  },
  routeTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  routeTitleActive: {
    color: colors.accent,
  },
  routeDetail: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  checkmark: {
    color: colors.accent,
    fontWeight: "800",
    fontSize: 14,
    marginLeft: spacing.xs,
  },
});
