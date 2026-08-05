import React from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { color, displayFont, type as textType } from '../../theme/tokens';

/**
 * 排版原语。variant 只给字号/字重/字距(中文安全,不带字族);
 * 唯有 display 变体默认贴自定义字体(其内容通常是账单标题/总额等拉丁+数字)。
 * 需要中文大标题时用 variant="heading",走系统字体。
 */
export type TextVariant =
  'display' | 'heading' | 'subhead' | 'body' | 'label' | 'muted';

export type TextTone =
  'default' | 'display' | 'muted' | 'faint' | 'primary' | 'danger' | 'inverse';

const toneColor: Record<TextTone, string> = {
  default: color.ink,
  display: color.inkDisplay,
  muted: color.inkMuted,
  faint: color.inkFaint,
  primary: color.primary,
  danger: color.danger,
  inverse: color.inkInverse,
};

export function Text({
  variant = 'body',
  tone = 'default',
  latin = false,
  style,
  ...rest
}: {
  variant?: TextVariant;
  tone?: TextTone;
  /** 内容保证是拉丁/数字时置 true,贴上自定义字体 */
  latin?: boolean;
} & TextProps) {
  return (
    <RNText
      style={[
        variants[variant],
        { color: toneColor[tone] },
        variant === 'display' || latin ? displayFont : null,
        style,
      ]}
      {...rest}
    />
  );
}

const variants = StyleSheet.create({
  display: {
    fontSize: textType.display.fontSize,
    lineHeight: textType.display.lineHeight,
    fontWeight: textType.display.fontWeight,
    letterSpacing: textType.display.letterSpacing,
    color: color.inkDisplay,
  },
  heading: {
    fontSize: textType.heading.fontSize,
    lineHeight: textType.heading.lineHeight,
    fontWeight: textType.heading.fontWeight,
    letterSpacing: textType.heading.letterSpacing,
  },
  subhead: {
    fontSize: textType.subhead.fontSize,
    lineHeight: textType.subhead.lineHeight,
    fontWeight: textType.subhead.fontWeight,
    letterSpacing: textType.subhead.letterSpacing,
  },
  body: {
    fontSize: textType.body.fontSize,
    lineHeight: textType.body.lineHeight,
    fontWeight: textType.body.fontWeight,
    letterSpacing: textType.body.letterSpacing,
  },
  label: {
    fontSize: textType.label.fontSize,
    lineHeight: textType.label.lineHeight,
    fontWeight: textType.label.fontWeight,
  },
  muted: {
    fontSize: textType.muted.fontSize,
    lineHeight: textType.muted.lineHeight,
    fontWeight: textType.muted.fontWeight,
  },
});
