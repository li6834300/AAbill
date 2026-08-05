import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLang } from '../lib/use-lang';
import { color, fontFamily, radius, space } from '../theme/tokens';
import { Avatar, Button, Input, Text } from './ui';
import { Close, Copy } from './icons';

export interface FamilyView {
  id: string;
  name: string;
  sortOrder: number;
  /** 该家 5 位认领口令(owner 视角才有) */
  accessCode: string;
}

/**
 * PRD B2:参与分账的家庭,用真实名字。每家一个稳定的身份色头像。
 * Beta:每家列出其 5 位认领口令 + 复制按钮 —— owner 把对应口令发给对应的人。
 */
export function FamilyChips({
  families,
  onAdd,
  onRemove,
  onCopyCode,
}: {
  families: FamilyView[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onCopyCode?: (code: string) => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };
  return (
    <View style={styles.wrap}>
      {families.length > 0 && (
        <View style={styles.list}>
          {families.map((f, i) => (
            <View key={f.id} style={styles.row}>
              <Avatar name={f.name} index={i} size={26} />
              <Text variant="label" numberOfLines={1} style={styles.flex}>
                {f.name}
              </Text>
              <Text style={styles.code}>{f.accessCode}</Text>
              <Pressable
                testID={`copy-code-${f.id}`}
                onPress={() => onCopyCode?.(f.accessCode)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('family.copyCode')}
                style={styles.iconBtn}
              >
                <Copy size={18} color={color.primary} />
              </Pressable>
              <Pressable
                testID={`remove-family-${f.id}`}
                onPress={() => onRemove(f.id)}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.iconBtn}
              >
                <Close size={18} color={color.inkMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.addRow}>
        <Input
          testID="family-input"
          style={styles.flex}
          value={name}
          onChangeText={setName}
          placeholder={t('family.placeholder')}
          onSubmitEditing={add}
        />
        <Button label={t('common.add')} onPress={add} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  flex: { flex: 1 },
  code: {
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
    fontSize: 17,
    letterSpacing: 3,
    color: color.inkDisplay,
  },
  iconBtn: { padding: space.xs },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
