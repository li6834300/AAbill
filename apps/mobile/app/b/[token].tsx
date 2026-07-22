import { claimableUnits, type Bill } from '@aabill/api-types';
import { vatCents } from '@aabill/core';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClaimItemRow } from '../../components/ClaimItemRow';
import { ClaimSuggestionReview } from '../../components/ClaimSuggestionReview';
import { api, type ClaimConflict } from '../../lib/api';
import { centsToEuro } from '../../lib/format';
import { pickInvoice } from '../../lib/pick-invoice';

const POLL_MS = 5000;

/**
 * PRD C1-C4:Participant 免登录认领页(/b/{share_token})。
 * 认领是**本地选择 + 一次提交**:每点一次就发请求延迟太高;底部实时算钱,确认后批量提交。
 */
export default function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedIds, setSuggestedIds] = useState<string[] | null>(null);
  /** 本地未提交的认领:itemId → 件数 */
  const [draft, setDraft] = useState<Record<string, number>>({});
  /** 提交被拒时的逐项原因 */
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setBill(await api.getShare(token));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!bill) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sub}>{error ?? '加载中…'}</Text>
      </View>
    );
  }

  const locked = bill.status === 'locked';
  // 税制未定(发票没读出、Owner 还没补选)→ 税额无从算,汇总只给净额。
  // 税率取账单上存的实际值(优先来自发票印刷),不在这里反查国家表。
  const rates = bill.taxRates;

  /** 选家庭时,用服务端已有的该家认领初始化本地草稿(轮询不会覆盖用户正在改的) */
  const selectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    const mine: Record<string, number> = {};
    for (const cl of bill.claims) {
      if (cl.familyId === familyId) mine[cl.itemId] = cl.portion;
    }
    setDraft(mine);
    setConflicts({});
    setSavedAt(null);
  };

  const othersPortions = (itemId: string) =>
    bill.claims
      .filter((cl) => cl.itemId === itemId && cl.familyId !== selectedFamilyId)
      .reduce((s, cl) => s + cl.portion, 0);

  const setPortion = (itemId: string, portion: number) => {
    setDraft((d) => ({ ...d, [itemId]: portion }));
    setConflicts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setSavedAt(null);
  };

  // 本地实时算钱:件数 × 单价(计重商品按整块),再按税类加税
  const chosen = bill.items.filter(
    (i) => !i.isShared && (draft[i.id] ?? 0) > 0,
  );
  const netCents = chosen.reduce((sum, i) => {
    const portion = draft[i.id] ?? 0;
    const isWeight =
      claimableUnits(i.qtyMilli) === 1 && i.qtyMilli % 1000 !== 0;
    const per = isWeight
      ? Math.round((i.qtyMilli * i.unitPriceMilli) / 10000)
      : Math.round(i.unitPriceMilli / 10);
    return sum + portion * per;
  }, 0);
  const grossCents =
    netCents +
    chosen.reduce((sum, i) => {
      const portion = draft[i.id] ?? 0;
      const isWeight =
        claimableUnits(i.qtyMilli) === 1 && i.qtyMilli % 1000 !== 0;
      const per = isWeight
        ? Math.round((i.qtyMilli * i.unitPriceMilli) / 10000)
        : Math.round(i.unitPriceMilli / 10);
      return rates ? sum + vatCents(portion * per, rates[i.taxClass]) : sum;
    }, 0);
  const chosenUnits = chosen.reduce((s, i) => s + (draft[i.id] ?? 0), 0);

  const dirty =
    selectedFamilyId !== null &&
    bill.claims.filter((c) => c.familyId === selectedFamilyId).length +
      chosen.length >
      0;

  const submit = async () => {
    if (!selectedFamilyId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.claimBatch(
        token!,
        selectedFamilyId,
        chosen.map((i) => ({ itemId: i.id, portion: draft[i.id] ?? 0 })),
      );
      if (res.ok) {
        setConflicts({});
        setSavedAt(Date.now());
        await refresh();
      } else {
        const map: Record<string, string> = {};
        for (const cf of res.conflicts as ClaimConflict[]) {
          map[cf.itemId] =
            `你要领 ${cf.requested} 件,但别家已领 ${cf.claimedByOthers} 件,只剩 ${cf.available} 件`;
        }
        setConflicts(map);
        setError('有商品被别人先领走了,请调整下面高亮的条目后重新提交');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  /** 拍照 → AI 建议(只写进本地草稿,仍需用户确认并提交) */
  const photoSuggest = async () => {
    const picked = await pickInvoice();
    if (!picked) return;
    setSuggesting(true);
    setError(null);
    try {
      const { suggestedItemIds } = await api.suggestClaims(
        token!,
        picked.base64,
        picked.mimeType,
      );
      setSuggestedIds(suggestedItemIds);
    } catch (e) {
      setError(`拍照识别失败:${String(e)}`);
    } finally {
      setSuggesting(false);
    }
  };

  const confirmSuggested = (itemIds: string[]) => {
    setSuggestedIds(null);
    setDraft((d) => {
      const next = { ...d };
      for (const id of itemIds) {
        if ((next[id] ?? 0) === 0) next[id] = 1; // 默认领 1 件,用户可再调
      }
      return next;
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{bill.title}</Text>
      {locked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>账单已锁定,认领结果不可再修改</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.section}>我是哪家?</Text>
      {bill.families.length === 0 ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            账单发起人还没添加参与的家庭,暂时无法认领。
          </Text>
          <Text style={styles.hint}>
            请让发起人在账单页的「参与家庭」里把大家加上,然后刷新本页。
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.chips}>
            {bill.families.map((f) => (
              <Pressable
                key={f.id}
                style={[
                  styles.chip,
                  selectedFamilyId === f.id && styles.chipOn,
                ]}
                onPress={() => selectFamily(f.id)}
              >
                <Text
                  style={
                    selectedFamilyId === f.id ? styles.chipOnText : undefined
                  }
                >
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {!selectedFamilyId && !locked && (
            <Text style={styles.hint}>先选择你的家庭,再勾选自己买的商品。</Text>
          )}
        </>
      )}

      {selectedFamilyId && !locked && (
        <>
          <Pressable
            style={styles.photoBtn}
            onPress={() => void photoSuggest()}
            disabled={suggesting}
          >
            <Text style={styles.photoBtnText}>
              {suggesting ? 'AI 识别中…' : '📷 拍照认领(AI 帮你预选)'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            对着你买的东西拍一张,AI 会猜哪些是你的 —— 结果需要你确认。
          </Text>
        </>
      )}

      {suggestedIds !== null && (
        <ClaimSuggestionReview
          items={bill.items.filter((i) => suggestedIds.includes(i.id))}
          onConfirm={confirmSuggested}
          onCancel={() => setSuggestedIds(null)}
        />
      )}

      <Text style={styles.section}>商品({bill.items.length})</Text>
      {bill.items.map((item) => (
        <ClaimItemRow
          key={item.id}
          item={item}
          myPortion={draft[item.id] ?? 0}
          othersPortions={othersPortions(item.id)}
          locked={locked || !selectedFamilyId}
          {...(conflicts[item.id] ? { conflict: conflicts[item.id] } : {})}
          onChange={(portion) => setPortion(item.id, portion)}
        />
      ))}

      {selectedFamilyId && !locked && (
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            已选 {chosen.length} 种 / 共 {chosenUnits} 件
          </Text>
          <Text style={styles.summaryTotal}>
            预计应付 {centsToEuro(grossCents)} €{rates ? '' : '(未含税)'}
          </Text>
          <Text style={styles.hint}>
            {rates
              ? `净额 ${centsToEuro(netCents)} € + 税;最终以发起人锁定后的汇总为准。`
              : '发起人尚未确定税制,暂只显示净额;最终以锁定后的汇总为准。'}
          </Text>
          <Pressable
            style={[styles.submitBtn, submitting && styles.disabled]}
            onPress={() => void submit()}
            disabled={submitting || !dirty}
          >
            <Text style={styles.submitText}>
              {submitting ? '提交中…' : '提交我的认领'}
            </Text>
          </Pressable>
          {savedAt !== null && (
            <Text style={styles.saved}>✓ 已提交,大家都能看到了</Text>
          )}
        </View>
      )}

      <Text style={styles.hint}>每 5 秒自动同步别家的认领状态。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: '700' },
  section: { marginTop: 12, fontWeight: '600', color: '#333' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#0a7',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: '#0a7' },
  chipOnText: { color: '#fff', fontWeight: '600' },
  hint: { color: '#999', fontSize: 12, marginTop: 8 },
  sub: { color: '#666', padding: 16 },
  error: { color: '#b42318' },
  lockedBanner: { backgroundColor: '#fff4e5', borderRadius: 8, padding: 12 },
  lockedText: { color: '#8a6d00', fontWeight: '600' },
  noticeBox: { backgroundColor: '#fff4e5', borderRadius: 8, padding: 12 },
  noticeText: { color: '#8a6d00', fontWeight: '600' },
  photoBtn: {
    backgroundColor: '#0a7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  photoBtnText: { color: '#fff', fontWeight: '600' },
  summary: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f6f8fa',
    gap: 4,
  },
  summaryLine: { color: '#333' },
  summaryTotal: { fontSize: 20, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#0a7',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700' },
  saved: { color: '#1a7f1a', fontWeight: '600', marginTop: 4 },
});
