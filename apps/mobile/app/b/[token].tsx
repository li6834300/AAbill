import { type Bill } from '@aabill/api-types';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ClaimItemRow } from '../../components/ClaimItemRow';
import { ClaimSuggestionReview } from '../../components/ClaimSuggestionReview';
import { LanguagePicker } from '../../components/LanguagePicker';
import { api, type ClaimConflict } from '../../lib/api';
import { claimTotals } from '../../lib/claim-total';
import { useLang } from '../../lib/use-lang';
import { pickInvoice } from '../../lib/pick-invoice';
import { color, radius, space } from '../../theme/tokens';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Money,
  Screen,
  StickyBar,
  Text,
  Toast,
} from '../../components/ui';
import { Camera, ChevronRight, Lock } from '../../components/icons';

const POLL_MS = 5000;
const BAR_HEIGHT = 96;

/**
 * PRD C1-C4:Participant 免登录认领页(/b/{share_token})。
 * 认领是**本地选择 + 一次提交**:每点一次就发请求延迟太高;底部实时算钱,确认后批量提交。
 */
export default function ClaimScreen() {
  const { t } = useLang();
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
  const [sharedOpen, setSharedOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 轮询时对比别家认领总件数,增加了就提示"别家的认领有更新"
  const othersTotalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api.getShare(token);
      setBill(() => {
        // 检测别家认领变化(仅在已选家庭后有基线)
        if (selectedFamilyId) {
          const othersTotal = next.claims
            .filter((cl) => cl.familyId !== selectedFamilyId)
            .reduce((s, cl) => s + cl.portion, 0);
          if (
            othersTotalRef.current !== null &&
            othersTotal > othersTotalRef.current
          ) {
            setToast(t('claim.othersUpdated'));
          }
          othersTotalRef.current = othersTotal;
        }
        return next;
      });
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [token, selectedFamilyId, t]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!bill) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          {error ?? t('common.loading')}
        </Text>
      </Screen>
    );
  }

  const locked = bill.status === 'locked';
  // 税制未定 → 税额无从算,汇总只给净额。税率取账单上存的实际值。
  const rates = bill.taxRates;
  const selectedFamily =
    bill.families.find((f) => f.id === selectedFamilyId) ?? null;

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
    othersTotalRef.current = bill.claims
      .filter((cl) => cl.familyId !== familyId)
      .reduce((s, cl) => s + cl.portion, 0);
  };

  const othersPortions = (itemId: string) =>
    bill.claims
      .filter((cl) => cl.itemId === itemId && cl.familyId !== selectedFamilyId)
      .reduce((s, cl) => s + cl.portion, 0);

  const othersClaimsFor = (itemId: string) =>
    bill.claims
      .filter((cl) => cl.itemId === itemId && cl.familyId !== selectedFamilyId)
      .map((cl) => ({
        familyIndex: bill.families.findIndex((f) => f.id === cl.familyId),
        name: bill.families.find((f) => f.id === cl.familyId)?.name ?? '',
      }));

  const setPortion = (itemId: string, portion: number) => {
    setDraft((d) => ({ ...d, [itemId]: portion }));
    setConflicts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setSavedAt(null);
  };

  const totals = claimTotals(bill.items, draft, rates);
  const chosen = bill.items.filter(
    (i) => !i.isShared && (draft[i.id] ?? 0) > 0,
  );
  const claimable = bill.items.filter((i) => !i.isShared);
  const shared = bill.items.filter((i) => i.isShared);

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
          map[cf.itemId] = t('claim.conflict', {
            requested: cf.requested,
            claimedByOthers: cf.claimedByOthers,
            available: cf.available,
          });
        }
        setConflicts(map);
        setError(t('claim.conflictHint'));
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
      setError(t('claim.photoFailed', { error: String(e) }));
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

  // ── 家庭门:未选家庭前只显示标题 + 家庭卡片,其余一律隐藏 ──
  const gate = !selectedFamilyId && !locked;

  return (
    <View style={styles.root}>
      <Toast message={toast} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen scroll bottomInset={selectedFamily && !locked ? BAR_HEIGHT : 0}>
          <Text variant="display" latin numberOfLines={2}>
            {bill.title}
          </Text>

          {locked && (
            <Banner tone="warning" icon={false}>
              <View style={styles.lockedLine}>
                <Lock size={18} color={color.accentInk} />
                <Text variant="label" style={{ color: color.accentInk }}>
                  {t('claim.lockedNotice')}
                </Text>
              </View>
            </Banner>
          )}
          {error && (
            <Text variant="body" tone="danger">
              {error}
            </Text>
          )}

          <LanguagePicker />

          {bill.families.length === 0 ? (
            <Banner tone="warning">
              <Text variant="label" style={{ color: color.accentInk }}>
                {t('claim.noFamilies')}
              </Text>
              <Text variant="muted" tone="muted">
                {t('claim.noFamiliesHint')}
              </Text>
            </Banner>
          ) : gate ? (
            // 家庭门
            <>
              <Text variant="heading" tone="display">
                {t('claim.whichFamily')}
              </Text>
              <View style={styles.familyGrid}>
                {bill.families.map((f, i) => (
                  <Pressable
                    key={f.id}
                    onPress={() => selectFamily(f.id)}
                    style={styles.familyCardWrap}
                  >
                    <Card style={styles.familyCard}>
                      <Avatar name={f.name} index={i} size={40} face />
                      <Text
                        variant="subhead"
                        numberOfLines={1}
                        style={styles.flex}
                      >
                        {f.name}
                      </Text>
                      <ChevronRight size={20} color={color.inkFaint} />
                    </Card>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            // 已选家庭:紧凑头 + 商品
            <>
              {selectedFamily && (
                <View style={styles.selectedHeader}>
                  <Avatar
                    name={selectedFamily.name}
                    index={bill.families.findIndex(
                      (f) => f.id === selectedFamily.id,
                    )}
                    size={28}
                  />
                  <Text variant="subhead" style={styles.flex}>
                    {selectedFamily.name}
                  </Text>
                  {!locked && (
                    <Button
                      label={t('claim.switchFamily')}
                      variant="ghost"
                      onPress={() => setSelectedFamilyId(null)}
                    />
                  )}
                </View>
              )}

              {selectedFamilyId && !locked && (
                <>
                  <Button
                    label={suggesting ? t('claim.photoBusy') : t('claim.photo')}
                    variant="secondary"
                    icon={Camera}
                    onPress={() => void photoSuggest()}
                    disabled={suggesting}
                    fullWidth
                  />
                  <Text variant="muted" tone="faint">
                    {t('claim.photoHint')}
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

              <Text variant="heading" tone="display" style={styles.sectionHead}>
                {t('claim.claimable', { n: claimable.length })}
              </Text>
              {claimable.map((item) => (
                <ClaimItemRow
                  key={item.id}
                  item={item}
                  myPortion={draft[item.id] ?? 0}
                  othersPortions={othersPortions(item.id)}
                  othersClaims={othersClaimsFor(item.id)}
                  locked={locked || !selectedFamilyId}
                  {...(conflicts[item.id]
                    ? { conflict: conflicts[item.id] }
                    : {})}
                  onChange={(portion) => setPortion(item.id, portion)}
                />
              ))}

              {shared.length > 0 && (
                <Card tone="sunk" style={styles.sharedCard}>
                  <Pressable
                    onPress={() => setSharedOpen((v) => !v)}
                    style={styles.sharedHead}
                  >
                    <Text variant="label" tone="muted" style={styles.flex}>
                      {t('claim.sharedGroup', { n: shared.length })}
                    </Text>
                    <Text variant="muted" tone="faint">
                      {sharedOpen ? '−' : '+'}
                    </Text>
                  </Pressable>
                  {sharedOpen &&
                    shared.map((i) => (
                      <Text key={i.id} variant="muted" tone="muted">
                        {i.name}
                        {i.nameTranslated ? ` · ${i.nameTranslated}` : ''}
                      </Text>
                    ))}
                </Card>
              )}

              <Text variant="muted" tone="faint" style={styles.autoSync}>
                {t('claim.autoSync')}
              </Text>
            </>
          )}
        </Screen>

        {selectedFamily && !locked && (
          <StickyBar>
            <View style={styles.flex}>
              <Text variant="muted" tone="muted">
                {t('claim.chosen', {
                  kinds: totals.kinds,
                  units: totals.units,
                })}
              </Text>
              <View style={styles.barMoney}>
                <Money cents={totals.grossCents} size="lg" tone="strong" />
                {!rates && (
                  <Text variant="muted" tone="faint">
                    {t('claim.exclTax')}
                  </Text>
                )}
              </View>
              {savedAt !== null && (
                <Text variant="muted" tone="primary">
                  {t('claim.submitted')}
                </Text>
              )}
            </View>
            <Button
              label={submitting ? t('claim.submitting') : t('claim.submit')}
              onPress={() => void submit()}
              disabled={submitting || !dirty}
              loading={submitting}
            />
          </StickyBar>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  lockedLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  familyGrid: { gap: space.md },
  familyCardWrap: {},
  familyCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.primaryTint,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  sectionHead: { marginTop: space.sm },
  sharedCard: { gap: space.sm },
  sharedHead: { flexDirection: 'row', alignItems: 'center' },
  autoSync: { marginTop: space.sm, textAlign: 'center' },
  barMoney: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
});
