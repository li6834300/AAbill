import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { color, layout, radius, space } from '../../theme/tokens';

/**
 * 卡片原语。白面浮在暖纸上,靠 1px hairline 描边分隔 —— 不用投影
 * (参照系统的明确要求:阴影会让暖纸质感变脏)。
 * tone="dashed" 给"扫发票"的拖拽入口;tone="sunk" 给下沉信息块。
 */
export function Card({
  tone = 'default',
  padded = true,
  style,
  ...rest
}: {
  tone?: 'default' | 'dashed' | 'sunk' | 'plain';
  padded?: boolean;
} & ViewProps) {
  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        tone === 'default' && styles.default,
        tone === 'dashed' && styles.dashed,
        tone === 'sunk' && styles.sunk,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md },
  padded: { padding: layout.cardPadding },
  default: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  dashed: {
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: space.xxl,
    alignItems: 'center',
  },
  sunk: {
    backgroundColor: color.canvasSunk,
    borderWidth: 1,
    borderColor: color.hairline,
  },
});
