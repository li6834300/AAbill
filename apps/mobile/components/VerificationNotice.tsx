import React from 'react';
import { StyleSheet } from 'react-native';
import { useLang } from '../lib/use-lang';
import { space } from '../theme/tokens';
import { Button, Card, Text } from './ui';

interface Props {
  /** 原样显示 —— 用户打错邮箱时,这是唯一能自己发现的线索 */
  email: string;
  onResend: () => void;
  /** 已重发过一次:给反馈并禁用按钮,防连点把人家邮箱刷爆 */
  resent?: boolean;
}

/** 注册后必须验证邮箱才能登录,这里告诉用户信发去哪了、下一步做什么。 */
export function VerificationNotice({ email, onResend, resent = false }: Props) {
  const { t } = useLang();
  return (
    <Card style={styles.card}>
      <Text variant="label" tone="muted">
        {t('verify.title')}
      </Text>
      <Text variant="body">{t('verify.sentTo', { email })}</Text>
      <Text variant="muted" tone="muted">
        {t('verify.expires')}
      </Text>
      {resent && (
        <Text variant="muted" tone="primary">
          {t('verify.resent')}
        </Text>
      )}
      <Button
        testID="resend-verification"
        label={t('verify.resend')}
        variant="ghost"
        onPress={onResend}
        disabled={resent}
        fullWidth
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
});
