import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from '../../theme/tokens';

/**
 * 固定底栏原语。安全区感知(取代 paddingBottom:48 魔法数),顶部一道 hairline 与内容分隔。
 * 用于认领页的"已选 N 样 · €金额 · 提交"实时汇总条。
 */
export function StickyBar({ children, style, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { paddingBottom: space.md + insets.bottom }, style]}
      {...rest}
    >
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: color.hairline,
    backgroundColor: color.surface,
    paddingTop: space.md,
    paddingHorizontal: layout.gutter,
  },
  inner: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
