import { itemNetCents } from '@aabill/core';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { centsToEuro, milliToDecimal } from '../lib/format';
import type { FamilyView } from './FamilyChips';
import type { ItemView } from './ItemRow';

export interface ClaimView {
  itemId: string;
  familyId: string;
  portion: number;
}

/** PRD C2:认领行 —— 勾选/份数;他家认领有标识;均摊与锁定为只读。 */
export function ClaimItemRow({
  item,
  families,
  claims,
  selectedFamilyId,
  locked,
  onSetPortion,
}: {
  item: ItemView;
  families: FamilyView[];
  claims: ClaimView[];
  selectedFamilyId: string | null;
  locked: boolean;
  onSetPortion: (portion: number) => void;
}) {
  const nameById = new Map(families.map((f) => [f.id, f.name]));
  const itemClaims = claims.filter((cl) => cl.itemId === item.id);
  const mine = selectedFamilyId
    ? itemClaims.find((cl) => cl.familyId === selectedFamilyId)
    : undefined;
  const lineNet = itemNetCents({
    qtyMilli: item.qtyMilli,
    unitPriceMilli: item.unitPriceMilli,
    taxClass: item.taxClass,
    ...(item.printedLineNetCents !== undefined && {
      printedLineNetCents: item.printedLineNetCents,
    }),
  });
  const canAct = !locked && !item.isShared && selectedFamilyId !== null;

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {item.nameZh ? `${item.nameZh} · ` : ''}
            {milliToDecimal(item.qtyMilli)} {item.unit} ×{' '}
            {milliToDecimal(item.unitPriceMilli)} €
          </Text>
        </View>
        <Text style={styles.amount}>{centsToEuro(lineNet)} €</Text>
      </View>
      <View style={styles.line}>
        <View style={[styles.flex, styles.badges]}>
          {item.isShared ? (
            <Text style={styles.shared}>均摊(全家庭平分)</Text>
          ) : (
            itemClaims.map((cl) => (
              <Text
                key={cl.familyId}
                style={[
                  styles.badge,
                  cl.familyId === selectedFamilyId && styles.badgeMine,
                ]}
              >
                {nameById.get(cl.familyId) ?? cl.familyId} ×{cl.portion}
              </Text>
            ))
          )}
        </View>
        {canAct &&
          (mine ? (
            <View style={styles.line}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => onSetPortion(mine.portion + 1)}
              >
                <Text style={styles.stepText}>＋</Text>
              </Pressable>
              <Pressable
                style={styles.stepBtn}
                onPress={() => onSetPortion(Math.max(1, mine.portion - 1))}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => onSetPortion(0)}>
                <Text style={styles.danger}>取消</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.claimBtn} onPress={() => onSetPortion(1)}>
              <Text style={styles.claimText}>认领</Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingVertical: 10,
    gap: 6,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  name: { fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  amount: { fontWeight: '600' },
  badge: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    overflow: 'hidden',
  },
  badgeMine: { backgroundColor: '#d1f2e0' },
  shared: { color: '#8a6d00', fontSize: 12 },
  claimBtn: {
    backgroundColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  claimText: { color: '#fff', fontWeight: '600' },
  stepBtn: {
    borderWidth: 1,
    borderColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepText: { color: '#0a7', fontWeight: '700' },
  btn: { padding: 6 },
  danger: { color: '#b42318' },
});
