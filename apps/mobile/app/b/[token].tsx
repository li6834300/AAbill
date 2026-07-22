import type { Bill } from '@aabill/api-types';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClaimItemRow } from '../../components/ClaimItemRow';
import { ClaimSuggestionReview } from '../../components/ClaimSuggestionReview';
import { api } from '../../lib/api';
import { pickInvoice } from '../../lib/pick-invoice';

const POLL_MS = 5000;

/** PRD C1-C4:Participant 免登录认领页(/b/{share_token}),5 秒轮询同步。 */
export default function ClaimScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // null = 未拍照;数组 = AI 建议结果待用户确认
  const [suggestedIds, setSuggestedIds] = useState<string[] | null>(null);

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
  const claimable = bill.items.filter((i) => !i.isShared);
  const claimedCount = claimable.filter((i) =>
    bill.claims.some((cl) => cl.itemId === i.id),
  ).length;

  const setPortion = async (itemId: string, portion: number) => {
    try {
      await api.putClaim(token!, {
        itemId,
        familyId: selectedFamilyId!,
        portion,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  /** 拍照 → AI 建议(只建议,确认后才认领) */
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

  /** 用户确认后,把选中的商品认领到自己家 */
  const confirmSuggested = async (itemIds: string[]) => {
    setSuggestedIds(null);
    for (const itemId of itemIds) {
      await setPortion(itemId, 1);
    }
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
                onPress={() => setSelectedFamilyId(f.id)}
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
          onConfirm={(ids) => void confirmSuggested(ids)}
          onCancel={() => setSuggestedIds(null)}
        />
      )}

      <Text style={styles.section}>
        商品(已认领 {claimedCount}/{claimable.length})
      </Text>
      {bill.items.map((item) => (
        <ClaimItemRow
          key={item.id}
          item={item}
          families={bill.families}
          claims={bill.claims}
          selectedFamilyId={selectedFamilyId}
          locked={locked}
          onSetPortion={(portion) => void setPortion(item.id, portion)}
        />
      ))}
      <Text style={styles.hint}>每 5 秒自动同步大家的认领状态。</Text>
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
  lockedBanner: {
    backgroundColor: '#fff4e5',
    borderRadius: 8,
    padding: 12,
  },
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
});
