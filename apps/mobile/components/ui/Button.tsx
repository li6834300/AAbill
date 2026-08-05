import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { color, radius, sticker, space } from '../../theme/tokens';
import { Text } from './Text';
import type { IconProps } from '../icons';

type Variant = 'primary' | 'danger' | 'secondary' | 'ghost';

/**
 * 按钮原语。primary/danger/secondary 是胶囊填充,深度来自**同色更深的下边框**
 * (贴纸效果,非投影 —— 三端一致且零成本);按下时下沿收窄、整体下移 2px。
 * ghost 是无填充文字链接(取代旧代码里"padding + 彩色文字"的裸按钮)。
 */
export function Button({
  label,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  icon: IconCmp,
  fullWidth = false,
  testID,
  ...rest
}: {
  label: string;
  variant?: Variant;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<IconProps>;
  fullWidth?: boolean;
} & Omit<PressableProps, 'children' | 'onPress' | 'disabled' | 'style'>) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  const isGhost = variant === 'ghost';
  const foreground = isDisabled ? color.inkFaint : v.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [
        styles.base,
        isGhost ? styles.ghost : styles.filled,
        !isGhost && {
          backgroundColor: v.bg,
          borderBottomColor: v.edge,
          borderBottomWidth: pressed
            ? sticker.pressedBorderWidth
            : sticker.restBorderWidth,
          transform: pressed
            ? [{ translateY: sticker.pressedTranslateY }]
            : undefined,
        },
        fullWidth && styles.fullWidth,
        isDisabled && !isGhost && styles.disabledFilled,
      ]}
      {...rest}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator size="small" color={foreground} />
        ) : (
          <>
            {IconCmp && <IconCmp size={18} color={foreground} />}
            <Text variant="label" style={[styles.label, { color: foreground }]}>
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; edge: string; fg: string }> = {
  primary: { bg: color.primary, edge: color.primaryDeep, fg: color.inkInverse },
  danger: { bg: color.danger, edge: '#8A3323', fg: color.inkInverse },
  secondary: { bg: color.surface, edge: color.border, fg: color.ink },
  ghost: { bg: 'transparent', edge: 'transparent', fg: color.primary },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  filled: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ghost: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabledFilled: {
    backgroundColor: color.canvasSunk,
    borderColor: color.border,
    borderBottomColor: color.border,
    opacity: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  label: { fontWeight: '700' },
});
