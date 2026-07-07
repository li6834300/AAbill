import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitleStyle: { fontWeight: '600' } }}>
      <Stack.Screen name="index" options={{ title: 'AAbill 账单' }} />
      <Stack.Screen name="bill/[id]" options={{ title: '账单详情' }} />
    </Stack>
  );
}
