import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLang } from '../lib/use-lang';

export interface FamilyView {
  id: string;
  name: string;
  sortOrder: number;
  /** 该家 5 位认领口令(owner 视角才有) */
  accessCode: string;
}

/**
 * PRD B2:参与分账的家庭,用真实名字。
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
    <View>
      <View style={styles.list}>
        {families.map((f) => (
          <View key={f.id} style={styles.row}>
            <Text style={styles.famName}>{f.name}</Text>
            <Text style={styles.code}>{f.accessCode}</Text>
            <Pressable
              testID={`copy-code-${f.id}`}
              onPress={() => onCopyCode?.(f.accessCode)}
              style={styles.copyBtn}
            >
              <Text style={styles.copyText}>{t('family.copyCode')}</Text>
            </Pressable>
            <Pressable
              testID={`remove-family-${f.id}`}
              onPress={() => onRemove(f.id)}
              style={styles.x}
            >
              <Text style={styles.xText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          testID="family-input"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('family.placeholder')}
        />
        <Pressable onPress={add} style={styles.btn}>
          <Text style={styles.btnText}>{t('common.add')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6, marginVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  famName: { flex: 1, fontWeight: '600' },
  code: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#1f3a8a',
  },
  copyBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  copyText: { color: '#1f6feb', fontSize: 12, fontWeight: '600' },
  x: { paddingHorizontal: 4 },
  xText: { color: '#666', fontSize: 16 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
  },
  btn: { padding: 8 },
  btnText: { color: '#0a7', fontWeight: '600' },
});
