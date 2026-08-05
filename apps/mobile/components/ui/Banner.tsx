import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { Check, Info, Warning } from '../icons';
import { color, radius, space } from '../../theme/tokens';

export type BannerTone = 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<
  BannerTone,
  {
    bg: string;
    fg: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
  }
> = {
  success: { bg: color.primaryTint, fg: color.primary, Icon: Check },
  warning: { bg: color.accentTint, fg: color.accentInk, Icon: Warning },
  danger: { bg: color.dangerTint, fg: color.danger, Icon: Warning },
  info: { bg: color.primaryTint, fg: color.primary, Icon: Info },
};

/**
 * 提示条原语。抽自 ValidationBanner 的三态(ok 绿 / near 黄 / mismatch 红),
 * 现在也服务于锁定横幅、翻译语言提示、无家庭提醒等。
 * 图标 + 内容并排;内容由调用方给,可含逐项差额等复杂结构。
 */
export function Banner({
  tone,
  icon = true,
  children,
  style,
  ...rest
}: {
  tone: BannerTone;
  icon?: boolean;
  children: React.ReactNode;
} & ViewProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }, style]} {...rest}>
      {icon && (
        <View style={styles.iconWrap}>
          <t.Icon size={18} color={t.fg} />
        </View>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** 供 Banner 内容用的语义色,让调用方文字与色调一致 */
export function bannerColor(tone: BannerTone): string {
  return TONES[tone].fg;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: space.md,
    borderRadius: radius.md,
    padding: space.md,
  },
  iconWrap: { paddingTop: 1 },
  body: { flex: 1, gap: space.xs },
});
