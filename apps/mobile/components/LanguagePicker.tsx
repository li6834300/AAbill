import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getLang, LANG_NAMES, LANGS, setLang, useLang } from '../lib/use-lang';
import { Chip } from './ui';
import { space } from '../theme/tokens';

/**
 * 语言切换器:四个语言各用自己的写法(中文/English/Nederlands/Deutsch),
 * 不随当前界面语言变 —— 看不懂当前语言的人才最需要这个控件。
 */
export function LanguagePicker() {
  useLang(); // 订阅语言变化,切换后本组件也要重渲染
  const current = getLang();
  return (
    <View style={styles.row} testID="language-picker">
      {LANGS.map((l) => (
        <Chip
          key={l}
          testID={`lang-${l}`}
          label={LANG_NAMES[l]}
          active={l === current}
          onPress={() => setLang(l)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
