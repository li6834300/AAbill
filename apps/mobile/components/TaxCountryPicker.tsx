import {
  reducedRateOptions,
  TAX_COUNTRIES,
  TAX_COUNTRY_NAMES,
  type TaxCountry,
  type TaxRates,
} from '@aabill/core';
import { countryName } from '../lib/country-name';
import React, { useState } from 'react';
import { useLang } from '../lib/use-lang';
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
 * 用户随时可改。刻意**不做成警告块** —— 一进详情页就弹一大片黄色太吵。
 *
 * 选国家时如果该国有多档低税率(法国有 7 档,含海外省与科西嘉),
 * 会追问食品适用哪一档 —— 自动挑一档必然算错钱。
 */
export function TaxCountryPicker({
  country,
  rates,
  onChange,
  busy = false,
}: {
  country: TaxCountry | null;
  rates: TaxRates | null;
  onChange: (c: TaxCountry, reducedRateBp?: number) => void;
  busy?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** 选了多档低税率的国家后,停在这一步等用户挑档位 */
  const [pendingCountry, setPendingCountry] = useState<TaxCountry | null>(null);

  const close = () => {
    setOpen(false);
    setQuery('');
    setPendingCountry(null);
  };

  const q = query.trim().toLowerCase();
  const shown = TAX_COUNTRIES.filter(
    (c) =>
      q === '' ||
      c.toLowerCase().includes(q) ||
      countryName(c).toLowerCase().includes(q) ||
      TAX_COUNTRY_NAMES[c].toLowerCase().includes(q),
  );

  const label = country
    ? rates
      ? t('tax.settledWithRates', {
          country: countryName(country),
          code: country,
          a: percentLabel(rates.A),
          b: percentLabel(rates.B),
        })
      : t('tax.settled', { country: countryName(country), code: country })
    : t('tax.pending');

  const pickCountry = (c: TaxCountry) => {
    if (reducedRateOptions(c).length > 1) {
      setPendingCountry(c); // 多档:再问一步,不猜
      return;
    }
    close();
    onChange(c, undefined);
  };

  const pickReduced = (bp: number) => {
    const c = pendingCountry;
    close();
    if (c) onChange(c, bp);
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
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {pendingCountry === null ? (
              <>
                <Text style={styles.sheetTitle}>{t('tax.pickCountry')}</Text>
                <Text style={styles.sheetHint}>{t('tax.pickHint')}</Text>
                <TextInput
                  testID="country-search"
                  style={styles.search}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('tax.searchPlaceholder')}
                  autoCorrect={false}
                />
                <ScrollView style={styles.list}>
                  {shown.map((c) => (
                    <Pressable
                      key={c}
                      testID={`option-${c}`}
                      style={[
                        styles.option,
                        c === country && styles.optionActive,
                      ]}
                      onPress={() => pickCountry(c)}
                    >
                      <Text style={styles.optionName}>
                        {countryName(c)} {c}
                      </Text>
                    </Pressable>
                  ))}
                  {shown.length === 0 && (
                    <Text style={styles.sheetHint}>{t('tax.noMatch')}</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>
                  {t('tax.multiReduced', {
                    country: countryName(pendingCountry),
                  })}
                </Text>
                <Text style={styles.sheetHint}>
                  {t('tax.multiReducedHint')}
                </Text>
                <ScrollView style={styles.list}>
                  {reducedRateOptions(pendingCountry).map((bp) => (
                    <Pressable
                      key={bp}
                      testID={`reduced-${bp}`}
                      style={styles.option}
                      onPress={() => pickReduced(bp)}
                    >
                      <Text style={styles.optionName}>{percentLabel(bp)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
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
