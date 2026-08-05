import React from 'react';
import { StyleSheet } from 'react-native';
import { centsToEuro } from '../lib/format';
import { useLang } from '../lib/use-lang';
import { Banner, bannerColor, Text } from './ui';

export interface ValidationResultView {
  ok: boolean;
  diffs: {
    netCents: number;
    vatByClass: { A: number; B: number };
    grossCents: number;
  };
}

// 各项差额都在此范围内 → 视为四舍五入尾差,柔和提示而非报警。
// 漏一件商品通常 ≥ 0.5€(≥50 分),不会落进这个容差。
const TOLERANCE_CENTS = 20;

/** PRD A4:校验提示条。对上=绿;小尾差=柔和黄;差额大=红,逐项高亮引导排查。 */
export function ValidationBanner({
  result,
}: {
  result: ValidationResultView | null;
}) {
  const { t } = useLang();
  if (!result) return null;

  const { diffs } = result;
  const rows = [
    { label: t('validate.netDiff'), cents: diffs.netCents },
    { label: t('validate.vatADiff'), cents: diffs.vatByClass.A },
    { label: t('validate.vatBDiff'), cents: diffs.vatByClass.B },
    { label: t('validate.grossDiff'), cents: diffs.grossCents },
  ].filter((r) => r.cents !== 0);

  const maxAbs = Math.max(0, ...rows.map((r) => Math.abs(r.cents)));

  if (result.ok || maxAbs === 0) {
    return (
      <Banner testID="validation-banner" tone="success">
        <Text variant="label" style={{ color: bannerColor('success') }}>
          {t('validate.ok')}
        </Text>
      </Banner>
    );
  }

  if (maxAbs <= TOLERANCE_CENTS) {
    return (
      <Banner testID="validation-banner" tone="warning">
        <Text variant="label" style={{ color: bannerColor('warning') }}>
          {t('validate.near', { amount: centsToEuro(diffs.grossCents) })}
        </Text>
      </Banner>
    );
  }

  return (
    <Banner testID="validation-banner" tone="danger">
      <Text
        variant="label"
        style={[styles.title, { color: bannerColor('danger') }]}
      >
        {t('validate.mismatch')}
      </Text>
      {rows.map((r) => (
        // 标签与金额必须同一个 Text 节点:测试用 /净额差 -5.58/ 匹配整串。
        <Text
          key={r.label}
          variant="body"
          style={{ color: bannerColor('danger') }}
        >
          {`${r.label} ${centsToEuro(r.cents)} €`}
        </Text>
      ))}
    </Banner>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '700' },
});
