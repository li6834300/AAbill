import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { color, layout, radius, space } from '../../theme/tokens';
import { Close } from '../icons';
import { Text } from './Text';

/**
 * 底/中弹层原语。抽自 TaxCountryPicker 的 Modal + 遮罩 + 白卡 —— 全 App 唯一的模态样式,
 * 现在也给锁定确认复用,不再各造一套模态语言。
 * 点遮罩关闭;点卡片本身不冒泡。
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = '80%',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number | `${number}%`;
}) {
  // RNW 的 Modal 遮罩 flex:1 会塌成内容高度,不铺满视口;显式钉到窗口高度。
  const { height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, { minHeight: height }]}
        onPress={onClose}
      >
        <Pressable style={[styles.sheet, { maxHeight }]} onPress={() => {}}>
          {title !== undefined && (
            <View style={styles.header}>
              <Text variant="subhead" tone="display" style={styles.title}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Close size={20} color={color.inkMuted} />
              </Pressable>
            </View>
          )}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: color.scrim,
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: { flex: 1 },
});
