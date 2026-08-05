import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, layout, space } from '../../theme/tokens';

/**
 * 屏幕容器原语。暖纸底色 + 统一左右留白。取代三处各写一遍的
 * {flex:1, padding:16, gap, backgroundColor:'#fff'}。
 *
 * scroll 时底部自动加上安全区 inset(取代旧的 paddingBottom:48 魔法数);
 * bottomInset 额外留出给固定底栏的高度。
 */
export function Screen({
  scroll = false,
  bottomInset = 0,
  gap = space.md,
  contentContainerStyle,
  style,
  children,
  ...rest
}: {
  scroll?: boolean;
  /** 固定底栏高度,给滚动内容让位 */
  bottomInset?: number;
  gap?: number;
} & ScrollViewProps &
  ViewProps) {
  const insets = useSafeAreaInsets();
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { gap, paddingBottom: space.xxl + bottomInset + insets.bottom },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        {...(rest as ScrollViewProps)}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View
      style={[styles.screen, styles.content, { gap }, style]}
      {...(rest as ViewProps)}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: {
    padding: layout.gutter,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
