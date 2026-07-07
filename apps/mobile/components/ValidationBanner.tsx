import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { centsToEuro } from '../lib/format';

export interface ValidationResultView {
  ok: boolean;
  diffs: {
    netCents: number;
    vatByClass: { A: number; B: number };
    grossCents: number;
  };
}

/** PRD A4:校验提示条。对上=绿色确认;有差额=逐项高亮,引导找漏行/错行。 */
export function ValidationBanner({
  result,
}: {
  result: ValidationResultView | null;
}) {
  if (!result) return null;
  if (result.ok) {
    return (
      <View testID="validation-banner" style={[styles.banner, styles.ok]}>
        <Text style={styles.okText}>✓ 与发票合计一致</Text>
      </View>
    );
  }
  const { diffs } = result;
  const rows = [
    { label: '净额差', cents: diffs.netCents },
    { label: 'A 税额差', cents: diffs.vatByClass.A },
    { label: 'B 税额差', cents: diffs.vatByClass.B },
    { label: '含税差', cents: diffs.grossCents },
  ].filter((r) => r.cents !== 0);
  return (
    <View testID="validation-banner" style={[styles.banner, styles.warn]}>
      <Text style={styles.warnTitle}>合计对不上,请核对条目:</Text>
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
  warn: { backgroundColor: '#fdeaea' },
  warnTitle: { color: '#b42318', fontWeight: '600', marginBottom: 4 },
  warnText: { color: '#b42318' },
});
