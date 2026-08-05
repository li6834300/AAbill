import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { centsToEuro } from '../../lib/format';
import { color, fontFamily, type as textType } from '../../theme/tokens';

/**
 * 金额展示原语。**金额与币种符号渲染为单个 Text 节点**(如 "6.55 €")——
 * SettlementTable 的测试 getByText('6.55 €') 依赖这一点,拆成两个节点会挂。
 *
 * 数字用 Plus Jakarta Sans + tabular-nums:金额列必须对齐。
 * 右对齐由调用方在布局上决定,这里只管字形与内容。
 */
export function Money({
  cents,
  size = 'md',
  currency = '€',
  tone = 'default',
  style,
  ...rest
}: {
  cents: number;
  /** md = 条目金额;lg = 底栏/汇总总额 */
  size?: 'md' | 'lg';
  currency?: string;
  /** default 墨色;muted 次级;strong 展示墨 */
  tone?: 'default' | 'muted' | 'strong';
} & Omit<TextProps, 'children'>) {
  const toneColor =
    tone === 'muted'
      ? color.inkMuted
      : tone === 'strong'
        ? color.inkDisplay
        : color.ink;
  return (
    <Text
      style={[
        size === 'lg' ? styles.lg : styles.md,
        { color: toneColor },
        style,
      ]}
      {...rest}
    >
      {`${centsToEuro(cents)} ${currency}`}
    </Text>
  );
}

// 字重烧在字族名里(PlusJakartaSans_600SemiBold / _700Bold),原生上 fontWeight 会被字族覆盖,
// 所以两个变体各自指定字族;web 端 numericFont 里的回退串由字族名带出。
const styles = StyleSheet.create({
  md: {
    fontSize: textType.money.fontSize,
    lineHeight: textType.money.lineHeight,
    letterSpacing: textType.money.letterSpacing,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
  lg: {
    fontSize: textType.moneyLg.fontSize,
    lineHeight: textType.moneyLg.lineHeight,
    letterSpacing: textType.moneyLg.letterSpacing,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
});
