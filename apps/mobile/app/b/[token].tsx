import { type FamilyClaimView, type ShareSummary } from '@aabill/api-types';
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
  Input,
  Money,
  Screen,
  StickyBar,
  Text,
  Toast,
} from '../../components/ui';
import { Camera, Lock } from '../../components/icons';
import { ReceiptMascot } from '../../components/characters/ReceiptMascot';

const POLL_MS = 5000;
const BAR_HEIGHT = 96;

/** 记住某账单的口令,刷新不用重输(web 持久化;原生仅内存,失败静默) */
const codeKey = (token: string) => `aabill_code_${token}`;
const readCode = (token: string): string | null => {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(codeKey(token))
      : null;
  } catch {
    return null;
  }
};
const writeCode = (token: string, code: string | null) => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (code) localStorage.setItem(codeKey(token), code);
    else localStorage.removeItem(codeKey(token));
  } catch {
    // 原生无 localStorage:忽略
  }
};

/** 该家的稳定色号:participant 只拿到自己家 {id,name},用 id 派生一个稳定色 */
const familyColorIndex = (id: string) =>
  [...id].reduce((s, c) => s + c.charCodeAt(0), 0);

const remainingSum = (v: FamilyClaimView) =>
  v.items.reduce((s, i) => s + i.remaining, 0);

/**
 * PRD C1-C4 + Beta:Participant 免登录认领页(/b/{share_token})。
 * 每家一个 5 位口令:输入自己那家的口令后,只能看/改自己那份,并看到每件"还剩几件可领"。
 * 认领是**本地选择 + 一次提交**:底部实时算钱,确认后批量提交。
 */
export default function ClaimScreen() {
  const { t } = useLang();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [summary, setSummary] = useState<ShareSummary | null>(null);
  const [view, setView] = useState<FamilyClaimView | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
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
  // 轮询对比"总剩余量",变少了说明别家刚认领 → 轻提示
  const remainingRef = useRef<number | null>(null);

  /** 凭口令进入自己那家;initDraft=true 时用服务端已有认领初始化本地草稿 */
  const enterWith = useCallback(
    async (c: string, initDraft = true) => {
      if (!token) return;
      try {
        const v = await api.enterFamily(token, c);
        setView(v);
        setCode(c);
        writeCode(token, c);
        setError(null);
        remainingRef.current = remainingSum(v);
        if (initDraft) {
          const mine: Record<string, number> = {};
          for (const i of v.items)
            if (i.myPortion > 0) mine[i.id] = i.myPortion;
          setDraft(mine);
          setConflicts({});
          setSavedAt(null);
        }
      } catch {
        setError(t('claim.codeWrong'));
      }
    },
    [token, t],
  );

  /** 轮询刷新 scoped 视图(不碰本地草稿:用户正在改的不能被覆盖) */
  const refreshView = useCallback(
    async (c: string) => {
      if (!token) return;
      try {
        const v = await api.enterFamily(token, c);
        const sum = remainingSum(v);
        if (remainingRef.current !== null && sum < remainingRef.current) {
          setToast(t('claim.othersUpdated'));
        }
        remainingRef.current = sum;
        setView(v);
        setError(null);
      } catch {
        // 轮询失败静默(可能锁定或网络抖动),不打断用户
      }
    },
    [token, t],
  );

  // 首屏:拿最小 summary;若本地存过口令,自动进入
  useEffect(() => {
    if (!token) return;
    let alive = true;
    void (async () => {
      try {
        const s = await api.getShareSummary(token);
        if (!alive) return;
        setSummary(s);
        const saved = readCode(token);
        if (saved) await enterWith(saved, false);
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, enterWith]);

  // 进入后定时刷新剩余量
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => void refreshView(code), POLL_MS);
    return () => clearInterval(timer);
  }, [code, refreshView]);

  const switchCode = () => {
    if (token) writeCode(token, null);
    setCode(null);
    setView(null);
    setCodeInput('');
    setDraft({});
    setConflicts({});
    setSavedAt(null);
    remainingRef.current = null;
  };

  const setPortion = (itemId: string, portion: number) => {
    setDraft((d) => ({ ...d, [itemId]: portion }));
    setConflicts((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setSavedAt(null);
  };

  // ── 输入口令前:最小首屏(口令门)──
  if (!view) {
    return (
      <Screen scroll>
        <Text variant="display" latin numberOfLines={2}>
          {summary?.title ?? t('common.loading')}
        </Text>
        <LanguagePicker />
        {summary && !summary.hasFamilies ? (
          <Banner tone="warning">
            <Text variant="label" style={{ color: color.accentInk }}>
              {t('claim.noFamilies')}
            </Text>
            <Text variant="muted" tone="muted">
              {t('claim.noFamiliesHint')}
            </Text>
          </Banner>
        ) : (
          <Card style={styles.codeCard}>
            <ReceiptMascot size={92} />
            <Text variant="heading" tone="display" style={styles.center}>
              {t('claim.enterTitle')}
            </Text>
            <Text variant="muted" tone="muted" style={styles.center}>
              {t('claim.enterHint')}
            </Text>
            <Input
              testID="code-input"
              style={styles.codeInput}
              value={codeInput}
              onChangeText={(v) =>
                setCodeInput(v.replace(/\D/g, '').slice(0, 5))
              }
              placeholder={t('claim.codePlaceholder')}
              keyboardType="number-pad"
              maxLength={5}
              onSubmitEditing={() =>
                codeInput.length === 5 && void enterWith(codeInput)
              }
            />
            {error && (
              <Text variant="body" tone="danger" style={styles.center}>
                {error}
              </Text>
            )}
            <Button
              testID="enter-btn"
              label={t('claim.enterBtn')}
              onPress={() => void enterWith(codeInput)}
              disabled={codeInput.length !== 5}
              fullWidth
            />
          </Card>
        )}
      </Screen>
    );
  }

  // ── 已进入自己那家 ──
  const locked = view.status === 'locked';
  const rates = view.taxRates;
  const claimable = view.items.filter((i) => !i.isShared);
  const shared = view.items.filter((i) => i.isShared);
  const totals = claimTotals(view.items, draft, rates);
  const chosen = view.items.filter(
    (i) => !i.isShared && (draft[i.id] ?? 0) > 0,
  );
  const dirty = Object.values(draft).some((n) => n > 0) || chosen.length > 0;

  const submit = async () => {
    if (!code) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.claimBatch(
        token!,
        code,
        chosen.map((i) => ({ itemId: i.id, portion: draft[i.id] ?? 0 })),
      );
      if (res.ok) {
        setConflicts({});
        setSavedAt(Date.now());
        await refreshView(code);
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

  const photoSuggest = async () => {
    if (!code) return;
    const picked = await pickInvoice();
    if (!picked) return;
    setSuggesting(true);
    setError(null);
    try {
      const { suggestedItemIds } = await api.suggestClaims(
        token!,
        code,
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
      for (const id of itemIds) if ((next[id] ?? 0) === 0) next[id] = 1;
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <Toast message={toast} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen scroll bottomInset={!locked ? BAR_HEIGHT : 0}>
          <Text variant="display" latin numberOfLines={2}>
            {view.billTitle}
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

          <View style={styles.familyHeader}>
            <Avatar
              name={view.family.name}
              index={familyColorIndex(view.family.id)}
              size={28}
              face
            />
            <Text variant="subhead" style={styles.flex}>
              {t('claim.youAre', { name: view.family.name })}
            </Text>
            <Button
              testID="switch-code"
              label={t('claim.switchCode')}
              variant="ghost"
              onPress={switchCode}
            />
          </View>

          {!locked && (
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
              items={view.items.filter((i) => suggestedIds.includes(i.id))}
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
              othersPortions={item.claimable - item.remaining}
              locked={locked}
              {...(conflicts[item.id] ? { conflict: conflicts[item.id] } : {})}
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
        </Screen>

        {!locked && (
          <StickyBar>
            <View style={styles.flex}>
              <Text variant="muted" tone="muted">
                {t('claim.chosen', {
                  kinds: chosen.length,
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
  center: { textAlign: 'center' },
  codeCard: { alignItems: 'center', gap: space.md },
  codeInput: {
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 8,
    alignSelf: 'stretch',
  },
  lockedLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  familyHeader: {
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
