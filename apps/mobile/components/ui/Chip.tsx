import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Close } from '../icons';
import { color, radius, space } from '../../theme/tokens';
import { Text } from './Text';

/**
 * 胶囊 chip 原语。合并三处各写一遍的实现(LanguagePicker / FamilyChips / 认领页家庭选择)。
 * active = 主色填充白字;inactive = 白底描边。可选前置元素(头像)与移除按钮。
 */
export function Chip({
  label,
  active = false,
  onPress,
  onRemove,
  removeTestID,
  leading,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  removeTestID?: string;
  leading?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={[styles.chip, active ? styles.on : styles.off]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        {...(testID ? { testID } : {})}
        style={styles.press}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={onPress ? { selected: active } : undefined}
      >
        {leading}
        <Text
          variant="label"
          style={{ color: active ? color.inkInverse : color.ink }}
        >
          {label}
        </Text>
      </Pressable>
      {onRemove && (
        <Pressable
          {...(removeTestID ? { testID: removeTestID } : {})}
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.remove}
        >
          <Close size={14} color={active ? color.inkInverse : color.inkMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    minHeight: 38,
  },
  press: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  on: { backgroundColor: color.primary },
  off: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  remove: { paddingLeft: space.sm, paddingVertical: space.sm },
});
