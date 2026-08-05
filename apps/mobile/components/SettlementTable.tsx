import React from 'react';
import { StyleSheet, View } from 'react-native';
import { centsToEuro } from '../lib/format';
import { t, useLang } from '../lib/use-lang';
import { color, radius, space } from '../theme/tokens';
import { Avatar, Money, Text } from './ui';

export interface SettlementView {
  families: Array<{
    familyId: string;
    name: string;
    netCents: number;
    vatCents: number;
    grossCents: number;
  }>;
  totals: { grossCents: number };
}

/** PRD D3:一键复制到群里的汇总文本。 */
export function buildSummaryText(
  title: string,
  settlement: SettlementView,
): string {
  const lines = settlement.families.map((f) =>
    t('settlement.summaryLine', {
      name: f.name,
      gross: centsToEuro(f.grossCents),
      net: centsToEuro(f.netCents),
      vat: centsToEuro(f.vatCents),
    }),
  );
  return [
    t('settlement.summaryTitle', { title }),
    ...lines,
    t('settlement.summaryTotal', {
      gross: centsToEuro(settlement.totals.grossCents),
    }),
  ].join('\n');
}

/** PRD D2:AA 汇总表 —— 每家净额/税额/含税,合计精确等于发票总额。 */
export function SettlementTable({
  settlement,
}: {
  settlement: SettlementView;
}) {
  useLang(); // 语言一变,下面的 t() 结果也要跟着重算
  return (
    <View style={styles.table}>
      {settlement.families.map((f, i) => (
        <View key={f.familyId} style={styles.row}>
          {/* 用色点而非带首字的头像:单字家庭名(如"甲")的首字会与名字文本冲突 */}
          <Avatar name={f.name} index={i} size={12} dotOnly />
          <View style={styles.info}>
            <Text variant="subhead" numberOfLines={1}>
              {f.name}
            </Text>
            <Text variant="muted" tone="muted">
              {t('settlement.breakdown', {
                net: centsToEuro(f.netCents),
                vat: centsToEuro(f.vatCents),
              })}
            </Text>
          </View>
          <Money cents={f.grossCents} tone="strong" />
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text variant="subhead" tone="display" style={styles.totalLabel}>
          {t('settlement.total')}
        </Text>
        <Money cents={settlement.totals.grossCents} size="lg" tone="strong" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
  },
  info: { flex: 1, gap: 2 },
  totalRow: { borderBottomWidth: 0, backgroundColor: color.canvasSunk },
  totalLabel: { flex: 1 },
});
