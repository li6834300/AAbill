import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getLang, LANG_NAMES, LANGS, setLang, useLang } from '../lib/use-lang';

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
        <Pressable
          key={l}
          testID={`lang-${l}`}
          onPress={() => setLang(l)}
          style={[styles.chip, l === current && styles.active]}
        >
          <Text style={[styles.text, l === current && styles.activeText]}>
            {LANG_NAMES[l]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  active: { backgroundColor: '#0a7', borderColor: '#0a7' },
  text: { fontSize: 12, color: '#666' },
  activeText: { color: '#fff', fontWeight: '600' },
});
