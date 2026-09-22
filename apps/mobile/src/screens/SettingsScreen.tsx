import { ScrollView, View, Text, Switch, Pressable, Alert, StyleSheet } from "react-native";
import { useState } from "react";
import { colors, spacing, typography } from "../theme/tokens";
import { scanMusicFolder } from "../library/scanner";
import { getLibraryDb } from "../providers";
import { useLibraryStore } from "../store/libraryStore";

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
  const hydrateFavorites = useLibraryStore((s) => s.hydrate);

  async function handleScan() {
    setScanning(true);
    try {
      const db = await getLibraryDb();
      const result = await scanMusicFolder(db);
      if (!result.cancelled) {
        hydrateFavorites();
        Alert.alert(
          "Scan complete",
          `${result.imported} file${result.imported === 1 ? "" : "s"} imported` +
            (result.unreadable > 0
              ? `, ${result.unreadable} could not be read and are listed as Unknown quality.`
              : ".")
        );
      }
    } catch (error) {
      Alert.alert("Scan failed", "Could not read that folder. Please try again.");
    } finally {
      setScanning(false);
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
      </View>
      <View style={styles.group}>
        <Text style={[typography.label, styles.groupTitle]}>ABOUT</Text>
        <Text style={[typography.caption, styles.about]}>AURA 0.0.1 — Phase 2a</Text>
      </View>
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
});
