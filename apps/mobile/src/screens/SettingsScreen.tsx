import { ScrollView, View, Text, Switch, Pressable, Alert, StyleSheet } from "react-native";
import { useState, useEffect } from "react";
import { colors, spacing, typography } from "../theme/tokens";
import { scanMusicFolder } from "../library/scanner";
import {
  getLibraryDb,
  getRegisteredProviders,
  setActiveProvider,
  getActiveProviderId,
  type ProviderId,
} from "../providers";
import { useLibraryStore } from "../store/libraryStore";
import { enrichLibrary } from "../metadata/enrichment";
import { enrichAudioFeatures } from "../metadata/audioFeaturesEnrichment";
import { useLibraryVersionStore } from "../store/libraryVersionStore";
import { useEqualizerStore } from "../store/equalizerStore";
import { useDownloadStore } from "../store/downloadStore";
import { EqualizerModal } from "../components/EqualizerModal";
import { DacInspector } from "../components/DacInspector";

interface SettingsRow {
  label: string;
  value: boolean;
}

function SettingsGroup({
  title,
  rows,
  onToggle,
}: {
  title: string;
  rows: SettingsRow[];
  onToggle: (label: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={[typography.label, styles.groupTitle]}>{title.toUpperCase()}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={typography.body}>{row.label}</Text>
          <Switch
            value={row.value}
            onValueChange={() => onToggle(row.label)}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={row.value ? colors.accent : colors.textTertiary}
          />
        </View>
      ))}
    </View>
  );
}

export function SettingsScreen() {
  const [playback, setPlayback] = useState<SettingsRow[]>([
    { label: "Gapless Playback", value: true },
    { label: "ReplayGain", value: false },
    { label: "Crossfade", value: false },
    { label: "Normalize Volume", value: false },
    { label: "Background Playback", value: true },
  ]);
  const [appearance, setAppearance] = useState<SettingsRow[]>([
    { label: "Reduce Animations", value: false },
  ]);

  function toggle(rows: SettingsRow[], setRows: (r: SettingsRow[]) => void, label: string) {
    setRows(rows.map((r) => (r.label === label ? { ...r, value: !r.value } : r)));
  }

  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [showEqModal, setShowEqModal] = useState(false);
  const [showDacModal, setShowDacModal] = useState(false);
  const { selectedPreset, bitPerfect } = useEqualizerStore();
  const { downloadedTracks, deleteDownload } = useDownloadStore();

  const [activeProviderId, setActiveProviderIdState] = useState<ProviderId>(
    getActiveProviderId()
  );
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);
  const bumpLibraryVersion = useLibraryVersionStore((s) => s.bump);

  useEffect(() => {
    setActiveProviderIdState(getActiveProviderId());
  }, []);

  function handleClearDownloads() {
    Alert.alert(
      "Purge Offline Cache",
      `Are you sure you want to delete ${downloadedTracks.size} downloaded track(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            for (const trackId of Array.from(downloadedTracks.keys())) {
              await deleteDownload(trackId);
            }
            Alert.alert("Cache Cleared", "All offline downloads removed.");
          },
        },
      ]
    );
  }

  async function handleSetProvider(id: ProviderId) {
    await setActiveProvider(id);
    setActiveProviderIdState(id);
  }

  async function handleScan() {
    setScanning(true);
    try {
      const db = await getLibraryDb();
      const result = await scanMusicFolder(db);
      if (!result.cancelled) {
        hydrateFavorites();
        bumpLibraryVersion();
        Alert.alert(
          "Scan complete",
          `${result.imported} file${result.imported === 1 ? "" : "s"} imported` +
            (result.unreadable > 0
              ? `, ${result.unreadable} could not be read and are listed as Unknown quality.`
              : ".")
        );
        void handleEnrich();
      }
    } catch (error) {
      Alert.alert("Scan failed", "Could not read that folder. Please try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const db = await getLibraryDb();
      const metadataResult = await enrichLibrary(db);
      const featuresResult = await enrichAudioFeatures(db);
      bumpLibraryVersion();
      const enriched = metadataResult.enriched + featuresResult.enriched;
      const skipped = metadataResult.skipped + featuresResult.skipped;
      if (enriched > 0 || skipped > 0) {
        Alert.alert(
          "Enrichment complete",
          `${enriched} item${enriched === 1 ? "" : "s"} enriched` +
            (skipped > 0 ? `, ${skipped} skipped.` : ".")
        );
      }
    } catch (error) {
      Alert.alert("Enrichment failed", "Could not fetch metadata. Please try again.");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[typography.title, styles.title]}>Settings</Text>
      <SettingsGroup
        title="Playback"
        rows={playback}
        onToggle={(label) => toggle(playback, setPlayback, label)}
      />
      <SettingsGroup
        title="Appearance"
        rows={appearance}
        onToggle={(label) => toggle(appearance, setAppearance, label)}
      />
      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>LIBRARY</Text>
        <Pressable style={styles.row} onPress={handleScan} disabled={scanning}>
          <Text style={typography.body}>
            {scanning ? "Scanning…" : "Scan Music Folder"}
          </Text>
        </Pressable>
        <Pressable style={styles.row} onPress={handleEnrich} disabled={enriching}>
          <Text style={typography.body}>
            {enriching ? "Enriching…" : "Enrich Metadata"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>MUSIC SOURCE</Text>
        <Text style={[typography.caption, styles.sourceHint]}>
          Choose where AURA fetches music. Local Library uses your device files.
          Internet Archive streams free, legally available recordings.
        </Text>
        {getRegisteredProviders().map((entry) => (
          <Pressable
            key={entry.id}
            style={styles.sourceRow}
            onPress={() => void handleSetProvider(entry.id as ProviderId)}
            accessibilityRole="radio"
            accessibilityState={{ checked: activeProviderId === entry.id }}
          >
            <View style={styles.radioOuter}>
              {activeProviderId === entry.id && <View style={styles.radioInner} />}
            </View>
            <View style={styles.sourceText}>
              <Text style={typography.body}>{entry.name}</Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {entry.description}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>AUDIOPHILE & DSP</Text>
        <Pressable
          onPress={() => setShowEqModal(true)}
          style={styles.actionRow}
          testID="settings-open-eq"
        >
          <View>
            <Text style={typography.body}>Equalizer & Bit-Perfect</Text>
            <Text style={[typography.caption, { color: colors.accent, marginTop: 2 }]}>
              {bitPerfect ? "Bit-Perfect Mode (DSP Bypassed)" : `${selectedPreset} Active`}
            </Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowDacModal(true)}
          style={styles.actionRow}
          testID="settings-open-dac"
        >
          <View>
            <Text style={typography.body}>Hardware DAC & Output Route</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              Inspect signal chain & audio path
            </Text>
          </View>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>OFFLINE DOWNLOADS</Text>
        <Pressable
          onPress={handleClearDownloads}
          style={styles.actionRow}
          testID="settings-clear-downloads"
        >
          <View>
            <Text style={typography.body}>Purge Offline Cache</Text>
            <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              Delete all downloaded audio files from device
            </Text>
          </View>
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>ABOUT</Text>
        <Text style={[typography.caption, styles.about]}>AURA 0.0.1 — Phase 8 (Audiophile Lossless)</Text>
      </View>

      <EqualizerModal visible={showEqModal} onClose={() => setShowEqModal(false)} />
      {showDacModal && <DacInspector />}
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
  title: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  about: {
    paddingHorizontal: spacing.md,
  },
  sourceHint: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textTertiary,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  sourceText: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  arrowText: {
    fontSize: 20,
    color: colors.textTertiary,
  },
});
