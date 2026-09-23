import { useRef } from "react";
import { View, PanResponder, StyleSheet, type LayoutChangeEvent } from "react-native";
import { colors } from "../theme/tokens";

interface SeekBarProps {
  /** Playback progress from 0 to 1 */
  progress: number;
  /** Called with the target ratio (0–1) when the user releases the thumb */
  onSeek: (ratio: number) => void;
  /** Total height of the component including the thumb */
  height?: number;
  /** Height of the track bar */
  trackHeight?: number;
  /** Diameter of the draggable thumb */
  thumbSize?: number;
}

export function SeekBar({
  progress,
  onSeek,
  height = 24,
  trackHeight = 4,
  thumbSize = 14,
}: SeekBarProps) {
  const barWidth = useRef(0);
  // Clamp progress to [0, 1]
  const clamped = Math.min(1, Math.max(0, progress));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (barWidth.current <= 0) return;
        const ratio = evt.nativeEvent.locationX / barWidth.current;
        onSeek(Math.min(1, Math.max(0, ratio)));
      },
      onPanResponderMove: (evt) => {
        if (barWidth.current <= 0) return;
        const ratio = evt.nativeEvent.locationX / barWidth.current;
        onSeek(Math.min(1, Math.max(0, ratio)));
      },
      onPanResponderRelease: (evt) => {
        if (barWidth.current <= 0) return;
        const ratio = evt.nativeEvent.locationX / barWidth.current;
        onSeek(Math.min(1, Math.max(0, ratio)));
      },
    })
  ).current;

  function handleLayout(event: LayoutChangeEvent) {
    barWidth.current = event.nativeEvent.layout.width;
  }

  const thumbOffset = clamped; // 0..1, used as flex proportion

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Seek bar"
      testID="seek-bar"
    >
      {/* Track */}
      <View style={[styles.track, { height: trackHeight, borderRadius: trackHeight / 2 }]}>
        {/* Filled portion */}
        <View
          style={[
            styles.filled,
            {
              flex: clamped,
              height: trackHeight,
              borderRadius: trackHeight / 2,
            },
          ]}
          testID="seek-bar-fill"
        />
        {/* Remaining portion */}
        <View style={{ flex: 1 - clamped }} />
      </View>
      {/* Thumb */}
      <View
        style={[
          styles.thumb,
          {
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            // Position the thumb centre at `clamped` fraction along the bar.
            // We use absolute positioning relative to the container.
            position: "absolute",
            left: `${clamped * 100}%` as unknown as number,
            marginLeft: -(thumbSize / 2),
            top: (height - thumbSize) / 2,
          },
        ]}
        testID="seek-bar-thumb"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "center",
  },
  track: {
    width: "100%",
    backgroundColor: colors.surfaceRaised,
    flexDirection: "row",
    overflow: "hidden",
  },
  filled: {
    backgroundColor: colors.accent,
  },
  thumb: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
});
