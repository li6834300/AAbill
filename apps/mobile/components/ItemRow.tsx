import { itemNetCents, toMilli } from '@aabill/core';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { centsToEuro, milliToDecimal } from '../lib/format';
import { useLang } from '../lib/use-lang';

export interface ItemView {
  id: string;
  name: string;
  nameZh: string;
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
  nameZh?: string;
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
  const [nameZh, setNameZh] = useState(item.nameZh);
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
    if (nameZh !== item.nameZh) patch.nameZh = nameZh;
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
        <TextInput
          testID="edit-name"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('item.name')}
        />
        <TextInput
          testID="edit-nameZh"
          style={styles.input}
          value={nameZh}
          onChangeText={setNameZh}
          placeholder={t('item.nameTranslated')}
        />
        <View style={styles.line}>
          <TextInput
            testID="edit-qty"
            style={[styles.input, styles.flex]}
            value={qtyText}
            onChangeText={setQtyText}
            placeholder={t('item.qty')}
          />
          <TextInput
            testID="edit-price"
            style={[styles.input, styles.flex]}
            value={priceText}
            onChangeText={setPriceText}
            placeholder={t('item.unitPrice')}
          />
        </View>
        <View style={styles.line}>
          <Pressable onPress={save} style={styles.btn}>
            <Text style={styles.btnText}>{t('common.save')}</Text>
          </Pressable>
          <Pressable onPress={() => setEditing(false)} style={styles.btn}>
            <Text>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {item.nameZh ? `${item.nameZh} · ` : ''}
            {milliToDecimal(item.qtyMilli)} {item.unit} ×{' '}
            {milliToDecimal(item.unitPriceMilli)} € ·{' '}
            {t('item.taxClass', { cls: item.taxClass })}
            {item.source === 'ai' ? ' · AI' : ''}
          </Text>
        </View>
        <Text style={styles.amount}>{centsToEuro(lineNet)} €</Text>
      </View>
      <View style={styles.line}>
        <View style={[styles.line, styles.flex]}>
          <Text style={styles.sub}>{t('item.shared')}</Text>
          <Switch
            testID="shared-switch"
            value={item.isShared}
            onValueChange={(v) => onPatch({ isShared: v })}
          />
        </View>
        <Pressable onPress={() => setEditing(true)} style={styles.btn}>
          <Text>{t('common.edit')}</Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.btn}>
          <Text style={styles.danger}>{t('common.delete')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingVertical: 8,
    gap: 4,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  name: { fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  amount: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginVertical: 2,
  },
  btn: { padding: 8 },
  btnText: { color: '#0a7', fontWeight: '600' },
  danger: { color: '#b42318' },
});
