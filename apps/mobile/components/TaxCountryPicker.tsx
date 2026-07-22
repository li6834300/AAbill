import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TaxCountry = 'DE' | 'NL';

const LABEL: Record<TaxCountry, string> = {
  DE: '德国 DE(19% / 7%)',
  NL: '荷兰 NL(21% / 9%)',
};

/**
 * 税制展示/选择。
 * 税率按账单国家取,而国家本来就印在发票上 —— 所以默认由识别得出,
 * 只有识别不出(value=null)时才回落到人工选择,不在上传发票前先问用户。
 */
export function TaxCountryPicker({
  value,
  onChange,
  busy = false,
}: {
  value: TaxCountry | null;
  onChange: (c: TaxCountry) => void;
  busy?: boolean;
}) {
  if (value) return <Text style={styles.settled}>税制 {LABEL[value]}</Text>;

  return (
    <View testID="tax-country-prompt" style={styles.prompt}>
      <Text style={styles.hint}>没能从发票识别出税制,请选择账单所属国家:</Text>
      <View style={styles.row}>
        {(['DE', 'NL'] as const).map((c) => (
          <Pressable
            key={c}
            testID={`pick-${c}`}
            style={[styles.btn, busy && styles.disabled]}
            onPress={() => !busy && onChange(c)}
          >
            <Text style={styles.btnText}>{LABEL[c]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  settled: { color: '#666', fontSize: 13, marginBottom: 8 },
  prompt: {
    backgroundColor: '#fff7e6',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  hint: { color: '#8a6d00', fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    backgroundColor: '#fff',
    borderColor: '#d9b400',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  btnText: { color: '#8a6d00', fontWeight: '600' },
});
