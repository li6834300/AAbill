import type { QuotaView } from '@aabill/api-types';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../lib/use-lang';
import { color, radius, space } from '../theme/tokens';
import { Text } from './ui';

/**
 * 本月 AI 识别额度。用完时转告警色 —— 用户该在点下"识别"之前就知道,
 * 而不是拍完照片才撞 402。
 */
export function QuotaBadge({ quota }: { quota: QuotaView }) {
  const { t } = useLang();
  const out = quota.remaining <= 0;
  const resets = new Date(quota.resetsAt).toLocaleDateString();

  return (
    <View
      testID="quota-badge"
      style={[styles.wrap, out ? styles.wrapOut : styles.wrapOk]}
    >
      <Text variant="muted" tone={out ? 'default' : 'muted'}>
        {out
          ? t('quota.exhausted')
          : t('quota.remaining', { n: String(quota.remaining) })}
      </Text>
      {out && (
        <Text variant="muted" tone="muted">
          {t('quota.resets', { date: resets })}
          {quota.plan === 'free' ? ` · ${t('quota.proHint')}` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    gap: space.xs,
  },
  wrapOk: { backgroundColor: color.canvasSunk },
  // 琥珀 = "需要你处理"(见 tokens);额度用完是正常状态,不是错误,故不用陶土红
  wrapOut: { backgroundColor: color.accentTint },
});
