import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useLang } from '../../lib/use-lang';
import { color, radius, space } from '../../theme/tokens';
import { Button, Card, Text } from '../ui';
import { Copy, Share as ShareIcon } from '../icons';

/**
 * 分享卡:展示链接 + 复制 + 唤起系统分享面板(RN 内置 Share,无需新依赖)。
 * 朋友点开链接即进免登录认领页。
 */
export function ShareCard({ url, title }: { url: string; title: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url, message: title }
          : { message: `${title}\n${url}` },
      );
    } catch {
      // 用户取消分享,忽略
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.urlBox}>
        <Text variant="muted" tone="muted" numberOfLines={1} selectable>
          {url}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={copied ? t('common.copied') : t('bill.copyLink')}
          variant="secondary"
          icon={copied ? undefined : Copy}
          onPress={copy}
          fullWidth
        />
        <Button
          label={t('bill.share')}
          icon={ShareIcon}
          onPress={() => void share()}
          fullWidth
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  urlBox: {
    backgroundColor: color.canvasSunk,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  actions: { gap: space.sm },
});
