import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

/**
 * 用户主动发起的远端操作统一使用此阻断层，避免等待期间重复提交。
 * AI 识别用更醒目的视觉层级；后台轮询不使用它，以免反复打断操作。
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
          style={[styles.card, isAi && styles.aiCard]}
          accessible
          accessibilityViewIsModal
          accessibilityRole="progressbar"
          accessibilityLabel={`${title}. ${message}`}
        >
          {isAi && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          <ActivityIndicator
            testID="blocking-wait-spinner"
            size="large"
            color={isAi ? '#0f766e' : '#2563eb'}
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
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
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  aiCard: {
    backgroundColor: '#f0fdfa',
    borderColor: '#5eead4',
  },
  aiBadge: {
    marginBottom: 18,
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 18,
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
