import type { Lang } from '@aabill/api-types';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { languageName } from '../lib/country-name';
import { useLang } from '../lib/use-lang';

/**
 * 账单的商品译名语言与当前界面语言不一致时的说明。
 *
 * 切界面语言刻意**不**重译已有条目(识别一张几十行的发票不便宜),
 * 但用户看到一堆看不懂的商品名却不知道为什么,是很糟的体验 ——
 * 所以这里把现状说清楚,并给出重新识别的入口,让他自己决定值不值。
 */
export function TranslationLangNotice({
  billLang,
  onRescan,
  busy = false,
}: {
  billLang: Lang | null;
  onRescan: () => void;
  busy?: boolean;
}) {
  const { t, lang } = useLang();
  if (billLang === null || billLang === lang) return null;

  return (
    <View testID="translation-lang-notice" style={styles.box}>
      <Text style={styles.text}>
        {t('translation.mismatch', { lang: languageName(billLang) })}
      </Text>
      <Pressable
        testID="rescan-for-lang"
        onPress={() => !busy && onRescan()}
        disabled={busy}
      >
        <Text style={[styles.action, busy && styles.disabled]}>
          {t('translation.rescan', { lang: languageName(lang) })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#eef4fb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  text: { color: '#3b5570', fontSize: 12 },
  action: { color: '#1f6feb', fontSize: 12, fontWeight: '600', marginTop: 6 },
  disabled: { opacity: 0.5 },
});
