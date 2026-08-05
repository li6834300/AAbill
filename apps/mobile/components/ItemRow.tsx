import { itemNetCents, toMilli } from '@aabill/core';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { milliToDecimal } from '../lib/format';
import { useLang } from '../lib/use-lang';
import { color, space } from '../theme/tokens';
import { Input, Money, Text } from './ui';
import { Sparkle } from './icons';

export interface ItemView {
  id: string;
  name: string;
  nameTranslated: string;
  qtyMilli: number;
  unit: string;
  unitPriceMilli: number;
  taxClass: 'A' | 'B';
  isShared: boolean;
  source: 'ai' | 'manual';
  printedLineNetCents?: number;
}

export interface ItemPatch {
  name?: string;
  nameTranslated?: string;
  qtyMilli?: number;
  unitPriceMilli?: number;
  isShared?: boolean;
}

const parseMilli = (text: string): number | null => {
  try {
    return toMilli(text.trim());
  } catch {
    return null;
  }
};

/** PRD A2/B3:条目行 —— 展示与修正(识别永远可能出错,人工校对是流程的一部分)。 */
export function ItemRow({
  item,
  onPatch,
  onDelete,
}: {
  item: ItemView;
  onPatch: (patch: ItemPatch) => void;
  onDelete: () => void;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [nameTranslated, setNameZh] = useState(item.nameTranslated);
  const [qtyText, setQtyText] = useState(milliToDecimal(item.qtyMilli));
  const [priceText, setPriceText] = useState(
    milliToDecimal(item.unitPriceMilli),
  );

  const lineNet = itemNetCents({
    qtyMilli: item.qtyMilli,
    unitPriceMilli: item.unitPriceMilli,
    taxClass: item.taxClass,
    ...(item.printedLineNetCents !== undefined && {
      printedLineNetCents: item.printedLineNetCents,
    }),
  });

  const save = () => {
    const patch: ItemPatch = {};
    if (name !== item.name && name.trim()) patch.name = name;
    if (nameTranslated !== item.nameTranslated)
      patch.nameTranslated = nameTranslated;
    const qty = parseMilli(qtyText);
    if (qty !== null && qty > 0 && qty !== item.qtyMilli) patch.qtyMilli = qty;
    const price = parseMilli(priceText);
    if (price !== null && price !== item.unitPriceMilli) {
      patch.unitPriceMilli = price;
    }
    onPatch(patch);
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={styles.row}>
        <Input
          testID="edit-name"
          value={name}
          onChangeText={setName}
          placeholder={t('item.name')}
        />
        <Input
          testID="edit-nameTranslated"
          value={nameTranslated}
          onChangeText={setNameZh}
          placeholder={t('item.nameTranslated')}
        />
        <View style={styles.line}>
          <Input
            testID="edit-qty"
            style={styles.flex}
            value={qtyText}
            onChangeText={setQtyText}
            placeholder={t('item.qty')}
            numeric
          />
          <Input
            testID="edit-price"
            style={styles.flex}
            value={priceText}
            onChangeText={setPriceText}
            placeholder={t('item.unitPrice')}
            numeric
          />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => setEditing(false)} style={styles.action}>
            <Text variant="label" tone="muted">
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Pressable onPress={save} style={styles.action}>
            <Text variant="label" tone="primary">
              {t('common.save')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <Text variant="subhead" numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            {item.source === 'ai' && (
              <Sparkle size={14} color={color.sunbeam} />
            )}
          </View>
          <Text variant="muted" tone="muted">
            {item.nameTranslated ? `${item.nameTranslated} · ` : ''}
            {milliToDecimal(item.qtyMilli)} {item.unit} ×{' '}
            {milliToDecimal(item.unitPriceMilli)} € ·{' '}
            {t('item.taxClass', { cls: item.taxClass })}
          </Text>
        </View>
        <Money cents={lineNet} tone="strong" />
      </View>
      <View style={styles.line}>
        <View style={[styles.line, styles.flex]}>
          <Text variant="muted" tone="muted">
            {t('item.shared')}
          </Text>
          <Switch
            testID="shared-switch"
            value={item.isShared}
            onValueChange={(v) => onPatch({ isShared: v })}
            trackColor={{ false: color.border, true: color.primary }}
            thumbColor={color.surface}
          />
        </View>
        <Pressable onPress={() => setEditing(true)} style={styles.action}>
          <Text variant="label" tone="muted">
            {t('common.edit')}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.action}>
          <Text variant="label" tone="danger">
            {t('common.delete')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    paddingVertical: space.md,
    gap: space.sm,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { flexShrink: 1 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs },
  action: { paddingHorizontal: space.sm, paddingVertical: space.xs },
});
