import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useLang } from '../lib/use-lang';
import { Button, Screen, Text } from '../components/ui';
import { space } from '../theme/tokens';

type State = 'working' | 'ok' | 'failed';

/**
 * 验证邮件里的链接落到这里(/verify?token=...)。
 * 验证成功即换到 JWT 并直接进首页 —— 让用户少一次手动登录。
 */
export default function VerifyScreen() {
  const { t } = useLang();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<State>('working');
  const [error, setError] = useState<string | null>(null);
  // Strict Mode 下 effect 会跑两次,而令牌是一次性的 —— 第二次必然失败,须防重入
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (!token) {
      setState('failed');
      return;
    }
    api
      .verifyEmail(token)
      .then(() => {
        setState('ok');
        router.replace('/');
      })
      .catch((e: unknown) => {
        setState('failed');
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [token, router]);

  return (
    <Screen gap={space.base}>
      <Text variant="heading" tone="display">
        {t('verify.title')}
      </Text>
      {state === 'working' && <Text variant="body">{t('verify.working')}</Text>}
      {state === 'ok' && (
        <Text variant="body" tone="primary">
          {t('verify.ok')}
        </Text>
      )}
      {state === 'failed' && (
        <>
          <Text variant="body" tone="danger">
            {error ?? t('verify.failed')}
          </Text>
          <Button
            testID="verify-back"
            label={t('verify.backHome')}
            onPress={() => router.replace('/')}
            fullWidth
          />
        </>
      )}
    </Screen>
  );
}
