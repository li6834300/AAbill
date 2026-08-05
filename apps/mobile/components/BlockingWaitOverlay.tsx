import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { Text } from './ui';

/**
 * 用户主动发起的远端操作统一使用此阻断层,避免等待期间重复提交。
 * AI 识别用更醒目的视觉层级(阳光黄徽标);后台轮询不使用它,以免反复打断操作。
 * 套设计系统配色,但保留 testID / 结构(BlockingWaitOverlay.test 依赖)。
 */
export function BlockingWaitOverlay({
  visible,
  title,
  message,
  variant = 'waiting',
}: {
  visible: boolean;
  title: string;
  message: string;
  variant?: 'waiting' | 'ai';
}) {
  if (!visible) return null;

  const isAi = variant === 'ai';
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View
          testID="blocking-wait-overlay"
          style={styles.card}
          accessible
          accessibilityViewIsModal
          accessibilityRole="progressbar"
          accessibilityLabel={`${title}. ${message}`}
        >
          {isAi && (
            <View style={styles.aiBadge}>
              <Text variant="label" style={styles.aiBadgeText}>
                AI
              </Text>
            </View>
          )}
          <ActivityIndicator
            testID="blocking-wait-spinner"
            size="large"
            color={isAi ? color.accent : color.primary}
          />
          <Text variant="heading" tone="display" style={styles.title}>
            {title}
          </Text>
          <Text variant="muted" tone="muted" style={styles.message}>
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: color.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
    gap: space.md,
  },
  aiBadge: {
    borderRadius: radius.pill,
    backgroundColor: color.sunbeam,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginBottom: space.xs,
  },
  aiBadgeText: { color: color.sunbeamInk, letterSpacing: 1.5 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center' },
});
