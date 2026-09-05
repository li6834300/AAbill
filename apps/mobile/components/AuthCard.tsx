import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useLang } from '../lib/use-lang';
import { space } from '../theme/tokens';
import { Button, Card, Input, Text } from './ui';

export type AuthMode = 'login' | 'register';

interface Props {
  onSubmit: (mode: AuthMode, email: string, password: string) => void;
  /** 服务端返回的错误(邮箱已注册 / 邮箱或密码不正确) */
  error?: string | null;
  busy?: boolean;
}

const MIN_PASSWORD = 8;

/**
 * 邮箱+密码登录/注册。
 * 此前生产没有任何可用登录方式(未配 GOOGLE_CLIENT_ID 且禁开 ALLOW_DEV_LOGIN),
 * 用户只能撞 401「需要登录」。这是第一条能自助进来的路径,注册免费。
 */
export function AuthCard({ onSubmit, error, busy = false }: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    // 切模式清掉上一次的校验提示,否则会挂着一句与当前模式无关的红字
    setLocalError(null);
  };

  const submit = () => {
    const mail = email.trim();
    if (!mail || !password) return;
    // 注册才做长度校验:登录只管把凭据交给服务端判定
    if (mode === 'register' && password.length < MIN_PASSWORD) {
      setLocalError(t('auth.passwordTooShort'));
      return;
    }
    setLocalError(null);
    onSubmit(mode, mail, password);
  };

  const shown = localError ?? error;

  return (
    <Card style={styles.card}>
      <Text variant="label" tone="muted">
        {mode === 'login' ? t('auth.login') : t('auth.register')}
      </Text>
      {mode === 'register' && (
        <Text variant="muted" tone="muted">
          {t('auth.freeHint')}
        </Text>
      )}
      <Input
        testID="auth-email"
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Input
        testID="auth-password"
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        onSubmitEditing={submit}
      />
      {shown && (
        <Text variant="body" tone="danger">
          {shown}
        </Text>
      )}
      <Button
        testID="auth-submit"
        label={
          mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')
        }
        onPress={submit}
        disabled={busy}
        fullWidth
      />
      <Pressable testID="auth-switch" onPress={switchMode}>
        <Text variant="muted" tone="muted" style={styles.switch}>
          {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
        </Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  switch: { textAlign: 'center' },
});
