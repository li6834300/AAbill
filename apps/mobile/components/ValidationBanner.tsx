import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { centsToEuro } from '../lib/format';
import { useLang } from '../lib/use-lang';

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
      <View testID="validation-banner" style={[styles.banner, styles.ok]}>
        <Text style={styles.okText}>{t('validate.ok')}</Text>
      </View>
    );
  }

  if (maxAbs <= TOLERANCE_CENTS) {
    return (
      <View testID="validation-banner" style={[styles.banner, styles.near]}>
        <Text style={styles.nearText}>
          {t('validate.near', { amount: centsToEuro(diffs.grossCents) })}
        </Text>
      </View>
    );
  }

  return (
    <View testID="validation-banner" style={[styles.banner, styles.warn]}>
      <Text style={styles.warnTitle}>{t('validate.mismatch')}</Text>
      {rows.map((r) => (
        <Text key={r.label} style={styles.warnText}>
          {r.label} {centsToEuro(r.cents)} €
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 8, padding: 12, marginVertical: 8 },
  ok: { backgroundColor: '#e6f6e6' },
  okText: { color: '#1a7f1a', fontWeight: '600' },
  near: { backgroundColor: '#fff7e6' },
  nearText: { color: '#8a6d00', fontWeight: '600' },
  warn: { backgroundColor: '#fdeaea' },
  warnTitle: { color: '#b42318', fontWeight: '600', marginBottom: 4 },
  warnText: { color: '#b42318' },
});
