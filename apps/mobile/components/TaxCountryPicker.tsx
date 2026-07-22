import {
  TAX_COUNTRIES,
  TAX_COUNTRY_NAMES,
  type TaxCountry,
  type TaxRates,
} from '@aabill/core';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/** 基点 → 显示用百分比:1900 → "19%",550 → "5.5%" */
export function percentLabel(bp: number): string {
  return `${String(bp / 100).replace(/\.0$/, '')}%`;
}

/**
 * 税制:常驻一个不显眼的下拉。
 *
 * 识别发票时会自动填上(税率优先取发票印的实际百分比,读不出才用国家表),
 * 用户随时可改。刻意**不做成警告块** —— 一进详情页就弹一大片黄色太吵,
 * 而且多数情况下识别是成功的,没什么可警告的。
 */
export function TaxCountryPicker({
  country,
  rates,
  onChange,
  busy = false,
}: {
  country: TaxCountry | null;
  rates: TaxRates | null;
  onChange: (c: TaxCountry) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = TAX_COUNTRIES.filter(
    (c) =>
      q === '' ||
      c.toLowerCase().includes(q) ||
      TAX_COUNTRY_NAMES[c].toLowerCase().includes(q),
  );

  const label = country
    ? `税制 ${TAX_COUNTRY_NAMES[country]} ${country}` +
      (rates ? ` · ${percentLabel(rates.A)} / ${percentLabel(rates.B)}` : '')
    : '税制待定 —— 点此选择国家';

  const pick = (c: TaxCountry) => {
    setOpen(false);
    setQuery('');
    onChange(c);
  };

  return (
    <View>
      <Pressable
        testID="tax-country-trigger"
        onPress={() => !busy && setOpen(true)}
      >
        <Text style={[styles.trigger, !country && styles.pending]}>
          {label} ▾
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>选择账单所属国家</Text>
            <Text style={styles.sheetHint}>
              税率以发票印刷值为准;这里选的国家只在发票读不出税率时用作兜底。
            </Text>
            <TextInput
              testID="country-search"
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="搜索国家或代码(如 法国 / FR)"
              autoCorrect={false}
            />
            <ScrollView style={styles.list}>
              {shown.map((c) => (
                <Pressable
                  key={c}
                  testID={`option-${c}`}
                  style={[styles.option, c === country && styles.optionActive]}
                  onPress={() => pick(c)}
                >
                  <Text style={styles.optionName}>
                    {TAX_COUNTRY_NAMES[c]} {c}
                  </Text>
                </Pressable>
              ))}
              {shown.length === 0 && (
                <Text style={styles.sheetHint}>没有匹配的国家</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { color: '#666', fontSize: 13, marginBottom: 8 },
  pending: { color: '#8a6d00', fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: '#0006',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  sheetHint: { color: '#666', fontSize: 12, marginBottom: 10 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  list: { flexGrow: 0 },
  option: { paddingVertical: 11, paddingHorizontal: 6, borderRadius: 6 },
  optionActive: { backgroundColor: '#e6f6f2' },
  optionName: { fontSize: 15 },
});
