import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Minus, Plus } from '../icons';
import { color, radius, space } from '../../theme/tokens';

/**
 * 加减步进器。夹逼逻辑集中在此:value 不得超过 max、不得低于 min(默认 0)。
 * testID 可注入,让 ClaimItemRow 继续用 dec-{id}/inc-{id}(现有测试依赖)。
 */
export function Stepper({
  value,
  max,
  min = 0,
  onChange,
  disabled = false,
  decTestID,
  incTestID,
}: {
  value: number;
  max: number;
  min?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  decTestID?: string;
  incTestID?: string;
}) {
  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;
  return (
    <View style={styles.row}>
      <Pressable
        {...(decTestID ? { testID: decTestID } : {})}
        accessibilityRole="button"
        style={[styles.btn, !canDec && styles.btnOff]}
        onPress={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        hitSlop={6}
      >
        <Minus size={18} color={canDec ? color.primary : color.inkFaint} />
      </Pressable>
      <Pressable
        {...(incTestID ? { testID: incTestID } : {})}
        accessibilityRole="button"
        style={[styles.btn, !canInc && styles.btnOff]}
        onPress={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        hitSlop={6}
      >
        <Plus size={18} color={canInc ? color.primary : color.inkFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  btn: {
    borderWidth: 1.5,
    borderColor: color.primary,
    borderRadius: radius.sm,
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  btnOff: { borderColor: color.border, opacity: 0.5 },
});
