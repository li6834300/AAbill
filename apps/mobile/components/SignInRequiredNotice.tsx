import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLang } from '../lib/use-lang';

/**
 * 未登录打开 owner 管理页(/bill/[id])时的引导。
 *
 * 真实事故:owner 把浏览器地址栏的管理页 URL 当分享链接发给了朋友,
 * 朋友打开就撞后端的 401「需要登录」。管理页确实需要登录,但朋友要的是**认领**,
 * 该用发起人页面里「复制分享链接」给出的认领链接(/b/…)。
 * 这里把这件事说清楚,而不是甩一个突兀的英文报错。
 */
export function SignInRequiredNotice({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useLang();
  return (
    <View testID="signin-required-notice" style={styles.box}>
      <Text style={styles.title}>{t('signin.title')}</Text>
      <Text style={styles.hint}>{t('signin.ownerHint')}</Text>
      <Text style={styles.hint}>{t('signin.claimerHint')}</Text>
      <Pressable testID="goto-signin" style={styles.btn} onPress={onSignIn}>
        <Text style={styles.btnText}>{t('signin.action')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '600' },
  hint: { color: '#555', fontSize: 14, lineHeight: 20 },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
