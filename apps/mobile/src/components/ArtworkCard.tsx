import { Pressable, View, Text, Image, StyleSheet } from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";

export function ArtworkCard({
  title,
  subtitle,
  artworkUrl,
  onPress,
}: {
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.artwork}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>{title.slice(0, 1)}</Text>
          </View>
        )}
      </View>
      <Text style={typography.body} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={typography.caption} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const CARD_WIDTH = 140;

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: spacing.md,
  },
  artwork: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.textTertiary,
  },
});
