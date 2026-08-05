import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, radius, space } from '../../theme/tokens';
import { Text } from './Text';

/**
 * 轻提示原语。用于认领页轮询到别家改动时的"有人认领了 N 样"——
 * 取代旧行为里列表在用户指下悄悄变动、毫无反馈。
 * message 变化即浮现,几秒后自动淡出。
 */
export function Toast({
  message,
  duration = 2600,
}: {
  message: string | null;
  duration?: number;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setShown(message);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setShown(null));
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, opacity]);

  if (!shown) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + space.md }]}
    >
      <Animated.View style={[styles.toast, { opacity }]}>
        <Text variant="label" tone="inverse">
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  toast: {
    backgroundColor: color.inkDisplay,
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
  },
});
