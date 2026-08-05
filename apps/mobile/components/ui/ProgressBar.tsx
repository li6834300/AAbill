import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius } from '../../theme/tokens';

/** 认领进度条。done/total → 主色填充,轨道用下沉暖纸色。 */
export function ProgressBar({
  done,
  total,
  height = 8,
}: {
  done: number;
  total: number;
  height?: number;
}) {
  const pct = total <= 0 ? 0 : Math.max(0, Math.min(1, done / total));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: color.canvasSunk, overflow: 'hidden' },
  fill: {
    height: '100%',
    backgroundColor: color.primary,
    borderRadius: radius.pill,
  },
});
