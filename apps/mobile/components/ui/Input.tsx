import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import {
  color,
  fontFamily,
  radius,
  space,
  type as textType,
} from '../../theme/tokens';

/**
 * 文本输入原语。取代散落 6 处的 borderWidth:1/#ccc/radius:6 块。
 * numeric 变体贴 tabular 数字字体,让金额/数量输入也对齐。
 */
export const Input = forwardRef<
  TextInput,
  TextInputProps & { numeric?: boolean }
>(function Input({ numeric = false, style, ...rest }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={color.inkFaint}
      style={[styles.input, numeric && styles.numeric, style]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: textType.body.fontSize,
    color: color.ink,
    backgroundColor: color.surface,
  },
  numeric: {
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
});
