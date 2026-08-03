import {
  claimableUnits,
  type FamilyClaimView,
  type ShareSummary,
} from '@aabill/api-types';
import { vatCents } from '@aabill/core';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ClaimItemRow } from '../../components/ClaimItemRow';
import { ClaimSuggestionReview } from '../../components/ClaimSuggestionReview';
import { LanguagePicker } from '../../components/LanguagePicker';
import { api, type ClaimConflict } from '../../lib/api';
import { centsToEuro } from '../../lib/format';
import { useLang } from '../../lib/use-lang';
import { pickInvoice } from '../../lib/pick-invoice';

const POLL_MS = 5000;

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

/**
 * PRD C1-C4 + Beta:Participant 免登录认领页(/b/{share_token})。
 * 每家一个 5 位口令:输入自己那家的口令后,只能看/改自己那份,并看到每件"还剩几件可领"。
 * 认领是**本地选择 + 一次提交**:每点一次就发请求延迟太高;底部实时算钱,确认后批量提交。
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

  /** 轮询刷新 scoped 视图(不碰本地草稿:用户正在改的不能被覆盖) */
  const refreshView = useCallback(
    async (c: string) => {
      if (!token) return;
      try {
        setView(await api.enterFamily(token, c));
        setError(null);
      } catch {
        // 轮询失败静默(可能锁定或网络抖动),不打断用户
      }
    },
    [token],
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
  }, [token]);

  // 进入后定时刷新剩余量
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => void refreshView(code), POLL_MS);
    return () => clearInterval(timer);
  }, [code, refreshView]);

  /** 输入口令进入自己那家;initDraft=true 时用服务端已有认领初始化本地草稿 */
  const enterWith = async (c: string, initDraft = true) => {
    if (!token) return;
    try {
      const v = await api.enterFamily(token, c);
      setView(v);
      setCode(c);
      writeCode(token, c);
      setError(null);
      if (initDraft) {
        const mine: Record<string, number> = {};
        for (const i of v.items) if (i.myPortion > 0) mine[i.id] = i.myPortion;
        setDraft(mine);
        setConflicts({});
        setSavedAt(null);
      }
    } catch {
      setError(t('claim.codeWrong'));
    }
  };

  const switchCode = () => {
    if (token) writeCode(token, null);
    setCode(null);
    setView(null);
    setCodeInput('');
    setDraft({});
    setConflicts({});
    setSavedAt(null);
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

  // ---- 输入口令前:最小首屏 ----
  if (!view) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {summary?.title ?? t('common.loading')}
        </Text>
        <LanguagePicker />
        {summary && !summary.hasFamilies ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{t('claim.noFamilies')}</Text>
            <Text style={styles.hint}>{t('claim.noFamiliesHint')}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.section}>{t('claim.enterTitle')}</Text>
            <Text style={styles.hint}>{t('claim.enterHint')}</Text>
            <TextInput
              testID="code-input"
              style={styles.codeInput}
              value={codeInput}
              onChangeText={(v) =>
                setCodeInput(v.replace(/\D/g, '').slice(0, 5))
              }
              placeholder={t('claim.codePlaceholder')}
              keyboardType="number-pad"
              maxLength={5}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              testID="enter-btn"
              style={[
                styles.submitBtn,
                codeInput.length !== 5 && styles.disabled,
              ]}
              disabled={codeInput.length !== 5}
              onPress={() => void enterWith(codeInput)}
            >
              <Text style={styles.submitText}>{t('claim.enterBtn')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    );
  }

  // ---- 已进入自己那家 ----
  const locked = view.status === 'locked';
  const rates = view.taxRates;
  const othersPortions = (claimable: number, remaining: number) =>
    claimable - remaining;

  const perCents = (i: FamilyClaimView['items'][number]) => {
    const isWeight =
      claimableUnits(i.qtyMilli) === 1 && i.qtyMilli % 1000 !== 0;
    return isWeight
      ? Math.round((i.qtyMilli * i.unitPriceMilli) / 10000)
      : Math.round(i.unitPriceMilli / 10);
  };
  const chosen = view.items.filter(
    (i) => !i.isShared && (draft[i.id] ?? 0) > 0,
  );
  const netCents = chosen.reduce(
    (s, i) => s + (draft[i.id] ?? 0) * perCents(i),
    0,
  );
  const grossCents =
    netCents +
    (rates
      ? chosen.reduce(
          (s, i) =>
            s + vatCents((draft[i.id] ?? 0) * perCents(i), rates[i.taxClass]),
          0,
        )
      : 0);
  const chosenUnits = chosen.reduce((s, i) => s + (draft[i.id] ?? 0), 0);
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
    const picked = await pickInvoice();
    if (!picked) return;
    setSuggesting(true);
    setError(null);
    try {
      const { suggestedItemIds } = await api.suggestClaims(
        token!,
        code!,
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{view.billTitle}</Text>
      {locked && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedText}>{t('claim.lockedNotice')}</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <LanguagePicker />

      <View style={styles.familyRow}>
        <Text style={styles.section}>
          {t('claim.youAre', { name: view.family.name })}
        </Text>
        <Pressable testID="switch-code" onPress={switchCode}>
          <Text style={styles.switchCode}>{t('claim.switchCode')}</Text>
        </Pressable>
      </View>

      {!locked && (
        <>
          <Pressable
            style={styles.photoBtn}
            onPress={() => void photoSuggest()}
            disabled={suggesting}
          >
            <Text style={styles.photoBtnText}>
              {suggesting ? t('claim.photoBusy') : t('claim.photo')}
            </Text>
          </Pressable>
          <Text style={styles.hint}>{t('claim.photoHint')}</Text>
        </>
      )}

      {suggestedIds !== null && (
        <ClaimSuggestionReview
          items={view.items.filter((i) => suggestedIds.includes(i.id))}
          onConfirm={confirmSuggested}
          onCancel={() => setSuggestedIds(null)}
        />
      )}

      <Text style={styles.section}>
        {t('claim.items', { n: view.items.length })}
      </Text>
      {view.items.map((item) => (
        <ClaimItemRow
          key={item.id}
          item={item}
          myPortion={draft[item.id] ?? 0}
          othersPortions={othersPortions(item.claimable, item.remaining)}
          locked={locked}
          {...(conflicts[item.id] ? { conflict: conflicts[item.id] } : {})}
          onChange={(portion) => setPortion(item.id, portion)}
        />
      ))}

      {!locked && (
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            {t('claim.chosen', { kinds: chosen.length, units: chosenUnits })}
          </Text>
          <Text style={styles.summaryTotal}>
            {t('claim.estimated', { amount: centsToEuro(grossCents) })}
            {rates ? '' : t('claim.exclTax')}
          </Text>
          <Text style={styles.hint}>
            {rates
              ? t('claim.netPlusTax', { amount: centsToEuro(netCents) })
              : t('claim.noTaxYet')}
          </Text>
          <Pressable
            style={[styles.submitBtn, submitting && styles.disabled]}
            onPress={() => void submit()}
            disabled={submitting || !dirty}
          >
            <Text style={styles.submitText}>
              {submitting ? t('claim.submitting') : t('claim.submit')}
            </Text>
          </Pressable>
          {savedAt !== null && (
            <Text style={styles.saved}>{t('claim.submitted')}</Text>
          )}
        </View>
      )}

      <Text style={styles.hint}>{t('claim.autoSync')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: '700' },
  section: { marginTop: 12, fontWeight: '600', color: '#333' },
  familyRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchCode: { color: '#1f6feb', fontSize: 12, fontWeight: '600' },
  codeInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 8,
  },
  hint: { color: '#999', fontSize: 12, marginTop: 8 },
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
