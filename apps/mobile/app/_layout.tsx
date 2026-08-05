import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { color, type as textType } from '../theme/tokens';
import { useLang } from '../lib/use-lang';

// 字体没加载完先扣住原生启动图,避免系统字→自定义字的闪跳。
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useLang(); // 语言一变,导航标题也要跟着变

  // 只加载 PJS(拉丁/数字用);中文走系统字体,不在这里加载。
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.canvas },
        headerShadowVisible: false, // 用暖纸底色的连续性代替阴影分隔
        headerTintColor: color.ink,
        headerTitleStyle: {
          color: color.inkDisplay,
          fontWeight: textType.subhead.fontWeight,
          fontSize: textType.subhead.fontSize,
        },
        contentStyle: { backgroundColor: color.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('nav.billList') }} />
      <Stack.Screen name="bill/[id]" options={{ title: t('nav.billDetail') }} />
      {/* 免登录认领页:从分享链接进来,自带大标题,不需要返回按钮的导航头 */}
      <Stack.Screen name="b/[token]" options={{ headerShown: false }} />
    </Stack>
  );
}
