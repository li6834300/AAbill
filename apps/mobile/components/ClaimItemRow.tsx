import { claimableUnits } from '@aabill/api-types';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { centsToEuro, milliToDecimal } from '../lib/format';
import { useLang } from '../lib/use-lang';
import { color, radius, space } from '../theme/tokens';
import { Avatar, Input, Money, Stepper, Text } from './ui';
import { Warning } from './icons';
import type { ItemView } from './ItemRow';

/**
 * 认领行:portion = **实际认领的件数**。
 * 用户必须看得见:单价、共几件、别家已领几件、我还能领几件、我这件领了多少钱。
 * 选择只改本地状态(onChange),由页面统一提交 —— 每点一次就发请求太慢。
 *
 * 视觉重设计:不再每行常驻输入框(42 行小票太吵),默认只给加减步进器;
 * **点数字**(qty-{id})才展开直接输入。
 */
export function ClaimItemRow({
  item,
  myPortion,
  othersPortions,
  othersClaims,
  locked,
  conflict,
  onChange,
}: {
  item: ItemView;
  /** 我当前(本地未提交)认领的件数 */
  myPortion: number;
  /** 别家已认领的件数之和 */
  othersPortions: number;
  /** 别家认领明细,用于显示身份色点(可选;不给则只显示数量文字) */
  othersClaims?: Array<{ familyIndex: number; name: string }>;
  locked: boolean;
  /** 提交被服务端拒绝时的原因(高亮用) */
  conflict?: string;
  onChange: (portion: number) => void;
}) {
  const totalUnits = claimableUnits(item.qtyMilli);
  const remaining = totalUnits - othersPortions;
  const isWeight = totalUnits === 1 && item.qtyMilli % 1000 !== 0;
  const unitPriceCents = Math.round(item.unitPriceMilli / 10);
  // 计重商品:整块的价钱 = 重量 × 单价;计件商品:件数 × 单价
  const myCents = isWeight
    ? myPortion * Math.round((item.qtyMilli * item.unitPriceMilli) / 10000)
    : myPortion * unitPriceCents;

  // 计件且不止一件时才值得"直接填";计重只有 0/1,步进器足够
  const canType = !isWeight && totalUnits > 1;

  const { t } = useLang();
  const [typing, setTyping] = useState(false);
  const [draftText, setDraftText] = useState(String(myPortion));
  const [inputError, setInputError] = useState<string | null>(null);
  useEffect(() => {
    setDraftText(String(myPortion));
    setInputError(null);
  }, [myPortion]);

  const confirmTyped = () => {
    const n = Number(draftText.trim());
    if (!Number.isInteger(n) || n < 0) {
      setInputError(t('claim.invalidQty'));
      return;
    }
    if (n > remaining) {
      setInputError(t('claim.maxQty', { n: remaining }));
      return;
    }
    setInputError(null);
    setTyping(false);
    onChange(n);
  };

  return (
    <View style={[styles.row, !!conflict && styles.conflictRow]}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <Text variant="subhead" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="muted" tone="muted">
            {item.nameTranslated ? `${item.nameTranslated} · ` : ''}
            {isWeight
              ? `${milliToDecimal(item.qtyMilli)} ${item.unit} × ${milliToDecimal(item.unitPriceMilli)} €`
              : t('claim.perPiece', {
                  price: centsToEuro(unitPriceCents),
                  total: totalUnits,
                })}
          </Text>
          {!item.isShared && othersPortions > 0 && (
            <View style={styles.othersLine}>
              {othersClaims && othersClaims.length > 0 && (
                <View style={styles.dots}>
                  {othersClaims.map((c, i) => (
                    <Avatar
                      key={i}
                      name={c.name}
                      index={c.familyIndex}
                      size={12}
                      dotOnly
                    />
                  ))}
                </View>
              )}
              <Text variant="muted" tone="muted">
                {t('claim.othersClaimed', {
                  others: othersPortions,
                  remaining,
                })}
              </Text>
            </View>
          )}
        </View>
        {myPortion > 0 && <Money cents={myCents} tone="strong" />}
      </View>

      {item.isShared ? (
        <Text variant="muted" style={styles.shared}>
          {t('claim.sharedItem')}
        </Text>
      ) : (
        !locked && (
          <View style={styles.controlLine}>
            {canType ? (
              <Pressable
                testID={`qty-${item.id}`}
                onPress={() => setTyping(true)}
                style={styles.qtyTap}
                accessibilityRole="button"
              >
                <Text variant="muted" tone="muted">
                  {t('claim.iTake')}
                </Text>
                <Text variant="subhead" tone="primary" style={styles.qtyNum}>
                  {myPortion}
                </Text>
                <Text variant="muted" tone="muted">
                  {t('claim.pieces')}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.qtyTap}>
                <Text variant="muted" tone="muted">
                  {t('claim.iTake')}
                </Text>
                <Text variant="subhead" tone="primary" style={styles.qtyNum}>
                  {myPortion}
                </Text>
                <Text variant="muted" tone="muted">
                  {t('claim.pieces')}
                </Text>
              </View>
            )}
            <View style={styles.flex} />
            <Stepper
              value={myPortion}
              max={remaining}
              onChange={onChange}
              decTestID={`dec-${item.id}`}
              incTestID={`inc-${item.id}`}
            />
          </View>
        )
      )}

      {typing && canType && !locked && (
        <View style={styles.typingBox}>
          <View style={styles.line}>
            <Input
              testID={`qty-input-${item.id}`}
              style={styles.qtyInput}
              value={draftText}
              onChangeText={(v) => {
                setDraftText(v);
                setInputError(null);
              }}
              keyboardType="number-pad"
              numeric
              autoFocus
              onSubmitEditing={confirmTyped}
            />
            <Text variant="muted" tone="muted">
              {t('claim.ofPieces', { n: remaining })}
            </Text>
            <View style={styles.flex} />
            <Pressable
              testID={`qty-confirm-${item.id}`}
              style={styles.confirmBtn}
              onPress={confirmTyped}
              accessibilityRole="button"
            >
              <Text variant="label" tone="primary">
                {t('common.confirm')}
              </Text>
            </Pressable>
          </View>
          {!!inputError && (
            <Text variant="muted" tone="danger">
              {inputError}
            </Text>
          )}
        </View>
      )}

      {!!conflict && (
        <View style={styles.conflictLine}>
          <Warning size={16} color={color.danger} />
          <Text variant="muted" tone="danger" style={styles.flex}>
            {conflict}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    paddingVertical: space.md,
    gap: space.sm,
  },
  conflictRow: {
    backgroundColor: color.dangerTint,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  othersLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dots: { flexDirection: 'row', gap: 2 },
  shared: { color: color.accentInk },
  controlLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  qtyTap: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  qtyNum: { minWidth: 20, textAlign: 'center' },
  typingBox: {
    gap: space.xs,
    backgroundColor: color.canvasSunk,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  qtyInput: { minWidth: 72 },
  confirmBtn: {
    backgroundColor: color.primaryTint,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  conflictLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
