export const colors = {
  background: "#0A0A0C",
  surface: "#151518",
  surfaceRaised: "#1F1F24",
  border: "#2A2A30",
  textPrimary: "#F5F4F2",
  textSecondary: "#9C9BA3",
  textTertiary: "#6B6A72",
  accent: "#D9A441",       // warm amber — distinct from Spotify green
  accentMuted: "#8A6A2E",
  lossless: "#4FA37A",
  hiRes: "#D9A441",
  lossy: "#8A8891",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.textPrimary },
  heading: { fontSize: 20, fontWeight: "600" as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400" as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: "400" as const, color: colors.textSecondary },
  label: { fontSize: 11, fontWeight: "600" as const, color: colors.textTertiary },
};

export const theme = { colors, spacing, radii, typography };
export type Theme = typeof theme;
