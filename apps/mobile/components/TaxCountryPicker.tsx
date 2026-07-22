import {
  reducedRateOptions,
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

/**
 * 国名中译。国名是稳定数据(不像税率会变),放在 UI 层即可;
 * 做 i18n 时这份表会并入语言包。core 只负责上游给的英文名。
 */
const NAME_ZH: Partial<Record<TaxCountry, string>> = {
  AT: '奥地利',
  BE: '比利时',
  BG: '保加利亚',
  CH: '瑞士',
  CY: '塞浦路斯',
  CZ: '捷克',
  DE: '德国',
  DK: '丹麦',
  EE: '爱沙尼亚',
  ES: '西班牙',
  FI: '芬兰',
  FR: '法国',
  GB: '英国',
  GR: '希腊',
  HR: '克罗地亚',
  HU: '匈牙利',
  IE: '爱尔兰',
  IS: '冰岛',
  IT: '意大利',
  LI: '列支敦士登',
  LT: '立陶宛',
  LU: '卢森堡',
  LV: '拉脱维亚',
  MT: '马耳他',
  NL: '荷兰',
  NO: '挪威',
  PL: '波兰',
  PT: '葡萄牙',
  RO: '罗马尼亚',
  SE: '瑞典',
  SI: '斯洛文尼亚',
  SK: '斯洛伐克',
};

const nameOf = (c: TaxCountry) => NAME_ZH[c] ?? TAX_COUNTRY_NAMES[c];

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
      nameOf(c).toLowerCase().includes(q) ||
      TAX_COUNTRY_NAMES[c].toLowerCase().includes(q),
  );

  const label = country
    ? `税制 ${nameOf(country)} ${country}` +
      (rates ? ` · ${percentLabel(rates.A)} / ${percentLabel(rates.B)}` : '')
    : '税制待定 —— 点此选择国家';

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
                      style={[
                        styles.option,
                        c === country && styles.optionActive,
                      ]}
                      onPress={() => pickCountry(c)}
                    >
                      <Text style={styles.optionName}>
                        {nameOf(c)} {c}
                      </Text>
                    </Pressable>
                  ))}
                  {shown.length === 0 && (
                    <Text style={styles.sheetHint}>没有匹配的国家</Text>
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>
                  {nameOf(pendingCountry)}有多档低税率
                </Text>
                <Text style={styles.sheetHint}>
                  食品适用哪一档因商品而异,自动挑一档会算错钱。请对照发票选择:
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
