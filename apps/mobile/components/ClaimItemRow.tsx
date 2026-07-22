import { claimableUnits } from '@aabill/api-types';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { centsToEuro, milliToDecimal } from '../lib/format';
import type { ItemView } from './ItemRow';

/**
 * 认领行:portion = **实际认领的件数**。
 * 用户必须看得见:单价、共几件、别家已领几件、我还能领几件、我这件领了多少钱。
 * 选择只改本地状态(onChange),由页面统一提交 —— 每点一次就发请求太慢。
 */
export function ClaimItemRow({
  item,
  myPortion,
  othersPortions,
  locked,
  conflict,
  onChange,
}: {
  item: ItemView;
  /** 我当前(本地未提交)认领的件数 */
  myPortion: number;
  /** 别家已认领的件数之和 */
  othersPortions: number;
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

  const canInc = !locked && myPortion < remaining;
  const canDec = !locked && myPortion > 0;

  // 件数多时逐个点太累:允许直接填数字,确认时校验
  const [draftText, setDraftText] = useState(String(myPortion));
  const [inputError, setInputError] = useState<string | null>(null);
  useEffect(() => {
    setDraftText(String(myPortion));
    setInputError(null);
  }, [myPortion]);

  const confirmTyped = () => {
    const n = Number(draftText.trim());
    if (!Number.isInteger(n) || n < 0) {
      setInputError('请输入 0 或正整数');
      return;
    }
    if (n > remaining) {
      setInputError(`最多可领 ${remaining} 件`);
      return;
    }
    setInputError(null);
    onChange(n);
  };

  return (
    <View style={[styles.row, !!conflict && styles.conflictRow]}>
      <View style={styles.line}>
        <View style={styles.flex}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>
            {item.nameZh ? `${item.nameZh} · ` : ''}
            {isWeight
              ? `${milliToDecimal(item.qtyMilli)} ${item.unit} × ${milliToDecimal(item.unitPriceMilli)} €`
              : `${centsToEuro(unitPriceCents)} €/件 · 共 ${totalUnits} 件`}
          </Text>
          {!item.isShared && othersPortions > 0 && (
            <Text style={styles.sub}>
              别家已领 {othersPortions} 件 · 还剩 {remaining} 件
            </Text>
          )}
        </View>
        {myPortion > 0 && (
          <Text style={styles.amount}>{centsToEuro(myCents)} €</Text>
        )}
      </View>

      {item.isShared ? (
        <Text style={styles.shared}>均摊(全家庭平分,无需认领)</Text>
      ) : (
        !locked && (
          <View style={styles.line}>
            <Text style={styles.flex}>
              <Text style={styles.sub}>我领 </Text>
              <Text style={styles.portion}>{myPortion}</Text>
              <Text style={styles.sub}> 件</Text>
            </Text>
            <Pressable
              testID={`dec-${item.id}`}
              style={[styles.step, !canDec && styles.stepOff]}
              onPress={() => canDec && onChange(myPortion - 1)}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Pressable
              testID={`inc-${item.id}`}
              style={[styles.step, !canInc && styles.stepOff]}
              onPress={() => canInc && onChange(myPortion + 1)}
            >
              <Text style={styles.stepText}>＋</Text>
            </Pressable>
          </View>
        )
      )}

      {!item.isShared && !locked && (
        <>
          <View style={styles.line}>
            <Text style={styles.sub}>直接填:</Text>
            <TextInput
              testID={`qty-input-${item.id}`}
              style={styles.qtyInput}
              value={draftText}
              onChangeText={(t) => {
                setDraftText(t);
                setInputError(null);
              }}
              keyboardType="number-pad"
              onSubmitEditing={confirmTyped}
            />
            <Text style={styles.sub}>/ {remaining} 件</Text>
            <Pressable
              testID={`qty-confirm-${item.id}`}
              style={styles.confirmBtn}
              onPress={confirmTyped}
            >
              <Text style={styles.confirmText}>确认</Text>
            </Pressable>
          </View>
          {!!inputError && <Text style={styles.inputError}>{inputError}</Text>}
        </>
      )}

      {!!conflict && <Text style={styles.conflictText}>⚠️ {conflict}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingVertical: 10,
    gap: 6,
  },
  conflictRow: {
    backgroundColor: '#fdeaea',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  conflictText: { color: '#b42318', fontWeight: '600' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  name: { fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  portion: { fontWeight: '700', fontSize: 16 },
  amount: { fontWeight: '700' },
  shared: { color: '#8a6d00', fontSize: 12 },
  step: {
    borderWidth: 1,
    borderColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  stepOff: { borderColor: '#ccc', opacity: 0.4 },
  stepText: { color: '#0a7', fontWeight: '700', fontSize: 16 },
  qtyInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 56,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: '#eef7f3',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confirmText: { color: '#0a7', fontWeight: '600' },
  inputError: { color: '#b42318', fontSize: 12 },
});
