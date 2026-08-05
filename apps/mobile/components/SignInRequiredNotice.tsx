import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLang } from '../lib/use-lang';
import { space } from '../theme/tokens';
import { Banner, Button, Screen, Text } from './ui';

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
    <Screen gap={space.lg} testID="signin-required-notice">
      <Text variant="heading" tone="display">
        {t('signin.title')}
      </Text>
      <Text variant="body" tone="muted">
        {t('signin.ownerHint')}
      </Text>
      <Banner tone="info">
        <Text variant="body" tone="muted">
          {t('signin.claimerHint')}
        </Text>
      </Banner>
      <View style={styles.actions}>
        <Button
          testID="goto-signin"
          label={t('signin.action')}
          onPress={onSignIn}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'flex-start' },
});
