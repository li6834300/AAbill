import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { centsToEuro } from '../lib/format';

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
  const lines = settlement.families.map(
    (f) =>
      `${f.name}:${centsToEuro(f.grossCents)} €(净 ${centsToEuro(f.netCents)} + 税 ${centsToEuro(f.vatCents)})`,
  );
  return [
    `${title} · AA 汇总`,
    ...lines,
    `合计:${centsToEuro(settlement.totals.grossCents)} €`,
  ].join('\n');
}

/** PRD D2:AA 汇总表 —— 每家净额/税额/含税,合计精确等于发票总额。 */
export function SettlementTable({
  settlement,
}: {
  settlement: SettlementView;
}) {
  return (
    <View style={styles.table}>
      {settlement.families.map((f) => (
        <View key={f.familyId} style={styles.row}>
          <Text style={styles.name}>{f.name}</Text>
          <Text style={styles.sub}>
            净 {centsToEuro(f.netCents)} + 税 {centsToEuro(f.vatCents)}
          </Text>
          <Text style={styles.amount}>{centsToEuro(f.grossCents)} €</Text>
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.name}>合计</Text>
        <Text style={styles.amount}>
          {centsToEuro(settlement.totals.grossCents)} €
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  totalRow: { borderBottomWidth: 0, backgroundColor: '#f6f8fa' },
  name: { fontWeight: '600', minWidth: 64 },
  sub: { color: '#666', fontSize: 12, flex: 1 },
  amount: { fontWeight: '700' },
});
