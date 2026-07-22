import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItemView } from './ItemRow';

/**
 * AI 拍照预选结果的确认面板(PRD 二期 PRO)。
 * 铁律:AI 只做建议,**必须人工确认**才真正认领 —— 所以这里默认全选但可逐项取消,
 * 并显著提示识别可能有误。
 */
export function ClaimSuggestionReview({
  items,
  onConfirm,
  onCancel,
}: {
  items: ItemView[];
  onConfirm: (itemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id)),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = items.filter((i) => selected.has(i.id)).map((i) => i.id);

  return (
    <View style={styles.panel}>
      <Text style={styles.warn}>
        ⚠️ 以下是 AI 看照片猜的,可能有误或有遗漏 —— 请你逐项确认后再认领。
      </Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>
          AI 没认出账单里的任何商品。可以换个角度重拍,或直接在下面手动勾选。
        </Text>
      ) : (
        items.map((i) => (
          <Pressable
            key={i.id}
            testID={`suggest-toggle-${i.id}`}
            style={styles.row}
            onPress={() => toggle(i.id)}
          >
            <Text style={selected.has(i.id) ? styles.boxOn : styles.boxOff}>
              {selected.has(i.id) ? '☑' : '☐'}
            </Text>
            <View style={styles.flex}>
              <Text style={styles.name}>{i.name}</Text>
              {!!i.nameZh && <Text style={styles.sub}>{i.nameZh}</Text>}
            </View>
          </Pressable>
        ))
      )}

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={onCancel}>
          <Text>取消</Text>
        </Pressable>
        {items.length > 0 && (
          <Pressable
            style={[styles.primary, chosen.length === 0 && styles.disabled]}
            onPress={() => chosen.length > 0 && onConfirm(chosen)}
          >
            <Text style={styles.primaryText}>确认认领({chosen.length})</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: '#f0c36d',
    backgroundColor: '#fffbf0',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    marginVertical: 8,
  },
  warn: { color: '#8a6d00', fontWeight: '600' },
  empty: { color: '#666', paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#eadfc0',
  },
  flex: { flex: 1 },
  boxOn: { fontSize: 20, color: '#0a7' },
  boxOff: { fontSize: 20, color: '#999' },
  name: { fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  btn: { padding: 8 },
  primary: {
    backgroundColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disabled: { opacity: 0.4 },
  primaryText: { color: '#fff', fontWeight: '600' },
});
