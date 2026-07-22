import { Stack } from 'expo-router';
import React from 'react';
import { useLang } from '../lib/use-lang';

export default function RootLayout() {
  const { t } = useLang(); // 语言一变,导航标题也要跟着变
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{ title: t('nav.billList') }} />
      <Stack.Screen name="bill/[id]" options={{ title: t('nav.billDetail') }} />
    </Stack>
  );
}
