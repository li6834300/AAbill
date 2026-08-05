import { claimableUnits } from '@aabill/api-types';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { milliToDecimal } from '../lib/format';
import { t, useLang } from '../lib/use-lang';
import { color, radius, space } from '../theme/tokens';
import { Button, Text } from './ui';
import { CheckSquare, Square, Warning } from './icons';
import type { ItemView } from './ItemRow';

/**
 * 重量/件数 + 单价 —— 同名商品(如 8 块牛肉)只有靠这个才能分辨,
 * 不显示的话用户面对一串一模一样的名字根本没法选。
 */
function describeQty(i: ItemView): string {
  const units = claimableUnits(i.qtyMilli);
  const isWeight = units === 1 && i.qtyMilli % 1000 !== 0;
  return isWeight
    ? `${milliToDecimal(i.qtyMilli)} ${i.unit} · ${milliToDecimal(i.unitPriceMilli)} €/${i.unit}`
    : t('suggest.perPiece', {
        n: units,
        price: milliToDecimal(i.unitPriceMilli),
      });
}

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
  useLang(); // 语言一变,下面的 label() 结果也要跟着重算
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
      <View style={styles.warnLine}>
        <Warning size={18} color={color.accentInk} />
        <Text variant="label" style={[styles.warn, styles.flex]}>
          {t('suggest.warning')}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text variant="body" tone="muted" style={styles.empty}>
          {t('suggest.none')}
        </Text>
      ) : (
        items.map((i) => {
          const on = selected.has(i.id);
          return (
            <Pressable
              key={i.id}
              testID={`suggest-toggle-${i.id}`}
              style={styles.row}
              onPress={() => toggle(i.id)}
            >
              {on ? (
                <CheckSquare size={22} color={color.primary} />
              ) : (
                <Square size={22} color={color.inkFaint} />
              )}
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>
                  {i.name}
                </Text>
                <Text variant="muted" tone="muted">
                  {i.nameTranslated ? `${i.nameTranslated} · ` : ''}
                  {describeQty(i)}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <View style={styles.actions}>
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        {items.length > 0 && (
          <Button
            label={t('suggest.confirm', { n: chosen.length })}
            onPress={() => chosen.length > 0 && onConfirm(chosen)}
            disabled={chosen.length === 0}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: color.accent,
    backgroundColor: color.accentTint,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  warnLine: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  warn: { color: color.accentInk },
  empty: { paddingVertical: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(122,82,0,0.2)',
  },
  flex: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginTop: space.xs,
  },
});
