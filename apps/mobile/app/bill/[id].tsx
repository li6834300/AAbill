import type { Bill } from '@aabill/api-types';
import { toMilli } from '@aabill/core';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { FamilyChips } from '../../components/FamilyChips';
import { ItemRow, type ItemPatch } from '../../components/ItemRow';
import {
  buildSummaryText,
  SettlementTable,
} from '../../components/SettlementTable';
import { TaxCountryPicker } from '../../components/TaxCountryPicker';
import { TranslationLangNotice } from '../../components/TranslationLangNotice';
import { ValidationBanner } from '../../components/ValidationBanner';
import { BillStages } from '../../components/bill/BillStages';
import { ShareCard } from '../../components/bill/ShareCard';
import {
  api,
  shareUrl,
  type SettlementResponse,
  type ValidateResponse,
} from '../../lib/api';
import {
  billStage,
  claimableItems,
  STAGES,
  type Stage,
} from '../../lib/bill-stage';
import { errorMessage } from '../../lib/error-message';
import { centsToEuro } from '../../lib/format';
import { useLang } from '../../lib/use-lang';
import { pickInvoice } from '../../lib/pick-invoice';
import {
  Banner,
  Button,
  Card,
  Input,
  ProgressBar,
  Screen,
  Sheet,
  Text,
} from '../../components/ui';
import { Camera, External, Lock, Plus } from '../../components/icons';
import { ReceiptMascot } from '../../components/characters/ReceiptMascot';
import { CoinMascot } from '../../components/characters/CoinMascot';
import { color, space } from '../../theme/tokens';

const TOLERANCE_CENTS = 20; // 与 ValidationBanner 一致:尾差内视为通过

const euroToCents = (text: string): number | null => {
  try {
    const milli = toMilli(text.trim());
    return milli % 10 === 0 ? milli / 10 : null; // 金额最多 2 位小数
  } catch {
    return null;
  }
};

/** 数据支持到达的最远阶段(locked 归入 summary);步骤条据此判断可达与打勾。 */
function furthestStage(bill: Bill, validation: ValidateResponse | null): Stage {
  const maxAbs = validation
    ? Math.max(
        Math.abs(validation.diffs.netCents),
        Math.abs(validation.diffs.vatByClass.A),
        Math.abs(validation.diffs.vatByClass.B),
        Math.abs(validation.diffs.grossCents),
      )
    : Infinity;
  const validationOk =
    !!validation && (validation.ok || maxAbs <= TOLERANCE_CENTS);
  const derived = billStage(bill, validationOk);
  return derived === 'locked' ? 'summary' : derived;
}

/** PRD M3:Owner 端闭环 —— 按阶段推进:扫发票 → 校对 → 分享 → 汇总。 */
export default function BillScreen() {
  const { t, lang } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [settlement, setSettlement] = useState<SettlementResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawError, setShowRawError] = useState(false);
  // 视图阶段是**用户驱动**的:首次进入停在数据支持的最远阶段,之后绝不自动前进。
  // 识别永远可能出错,校对是必经步骤 —— 不能因为"恰好校验通过"就把用户甩去下一步。
  const [viewStage, setViewStage] = useState<Stage | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [totalsDraft, setTotalsDraft] = useState({
    net: '',
    vatA: '',
    vatB: '',
    gross: '',
  });

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const b = await api.getBill(id);
      setBill(b);
      setValidation(await api.validate(id));
      setSettlement(await api.settlement(id));
      if (b.printedTotals) {
        setTotalsDraft({
          net: centsToEuro(b.printedTotals.netCents),
          vatA: centsToEuro(b.printedTotals.vatByClass.A),
          vatB: centsToEuro(b.printedTotals.vatByClass.B),
          gross: centsToEuro(b.printedTotals.grossCents),
        });
      }
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const pickAndParse = () =>
    // 识别完成后**强制停在校对**:让用户逐条核对 AI 结果(可能错、可能漏),不自动前进。
    run(t('bill.parsing'), async () => {
      const picked = await pickInvoice();
      if (!picked) return;
      setViewStage('review');
      const beforeAiIds = new Set(
        (bill?.items ?? []).filter((i) => i.source === 'ai').map((i) => i.id),
      );
      const hasNewAiItems = async () => {
        const b = await api.getBill(id!);
        return b.items.some((i) => i.source === 'ai' && !beforeAiIds.has(i.id));
      };
      try {
        await api.parse(id!, picked.base64, picked.mimeType, lang);
      } catch {
        // Heroku 30s 网关超时:识别很可能仍在后台完成 → 轮询等结果
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          if (await hasNewAiItems()) return;
        }
        throw new Error(t('bill.parseTimeout'));
      }
    });

  const saveTotals = () =>
    // 存完合计仍**停在校对**:让用户看校验结果、逐条核对,不因"恰好对上"就前进。
    run(t('bill.savingTotals'), async () => {
      setViewStage('review');
      const net = euroToCents(totalsDraft.net);
      const vatA = euroToCents(totalsDraft.vatA);
      const vatB = euroToCents(totalsDraft.vatB);
      const gross = euroToCents(totalsDraft.gross);
      if (net === null || vatA === null || vatB === null || gross === null) {
        throw new Error(t('bill.badAmount'));
      }
      await api.putTotals(id!, {
        netCents: net,
        vatByClass: { A: vatA, B: vatB },
        grossCents: gross,
      });
    });

  const addBlankItem = () =>
    run(t('bill.adding'), () =>
      api.addItem(id!, {
        name: t('bill.newItem'),
        nameTranslated: '',
        qtyMilli: 1000,
        unit: 'ST',
        unitPriceMilli: 0,
        taxClass: 'B',
        isShared: false,
      }),
    );

  if (!bill) {
    return (
      <Screen>
        <Text variant="body" tone="muted">
          {error ? errorMessage(error).message : t('common.loading')}
        </Text>
      </Screen>
    );
  }

  // ── 阶段推导 ──
  const locked = bill.status === 'locked';
  const furthest = furthestStage(bill, validation); // 数据支持的最远阶段(步骤条据此)
  // 显示阶段 = 用户当前所在,但不越过 furthest(删条目导致数据回退时自动收回)。
  const target = viewStage ?? furthest;
  const shownStage: Stage =
    STAGES[Math.min(STAGES.indexOf(target), STAGES.indexOf(furthest))]!;
  // 能否再往前一步(用于「下一步」按钮)
  const canGoNext = STAGES.indexOf(shownStage) < STAGES.indexOf(furthest);
  const goNext = () =>
    setViewStage(STAGES[STAGES.indexOf(shownStage) + 1] ?? shownStage);

  const claimable = claimableItems(bill);
  const claimedCount = claimable.filter((i) =>
    bill.claims.some((cl) => cl.itemId === i.id),
  ).length;

  const copy = async (what: 'link' | 'summary') => {
    const text =
      what === 'link'
        ? shareUrl(bill.shareToken)
        : settlement
          ? buildSummaryText(bill.title, settlement)
          : '';
    await Clipboard.setStringAsync(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const friendly = error ? errorMessage(error) : null;

  return (
    <>
      <Screen scroll>
        <Text variant="display" latin numberOfLines={2}>
          {bill.title}
        </Text>

        {!locked && (
          <BillStages
            current={furthest}
            viewing={shownStage}
            onSelect={setViewStage}
          />
        )}

        {locked && (
          <Banner tone="warning" icon={false}>
            <View style={styles.iconLine}>
              <Lock size={18} color={color.accentInk} />
              <Text variant="label" style={{ color: color.accentInk }}>
                {t('claim.lockedNotice')}
              </Text>
            </View>
          </Banner>
        )}

        {friendly && (
          <Banner tone="danger">
            <Text variant="body" style={{ color: color.danger }}>
              {friendly.message}
            </Text>
            <Pressable onPress={() => setShowRawError((v) => !v)}>
              <Text variant="muted" style={{ color: color.danger }}>
                {t('common.details')}
              </Text>
            </Pressable>
            {showRawError && (
              <Text variant="muted" tone="muted">
                {friendly.raw}
              </Text>
            )}
          </Banner>
        )}

        {busy && (
          <Text variant="muted" tone="muted">
            {busy}
          </Text>
        )}

        {/* ── 阶段卡 ── */}
        {shownStage === 'scan' && (
          <Card tone="dashed">
            <ReceiptMascot size={104} pose="scan" />
            <Text variant="subhead" tone="display" style={styles.center}>
              {t('stage.scanTitle')}
            </Text>
            <Text variant="muted" tone="muted" style={styles.center}>
              {t('stage.scanHint')}
            </Text>
            <View style={styles.scanTax}>
              <TaxCountryPicker
                country={bill.taxCountry}
                rates={bill.taxRates}
                onChange={async (c, reducedRateBp) => {
                  setBusy(t('bill.savingTax'));
                  try {
                    setBill(await api.setTaxCountry(bill.id, c, reducedRateBp));
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setBusy(null);
                  }
                }}
                busy={!!busy}
              />
            </View>
            <Button
              label={t('bill.upload')}
              icon={Camera}
              onPress={pickAndParse}
              disabled={!!busy}
              fullWidth
            />
          </Card>
        )}

        {shownStage === 'review' && (
          <View style={styles.stageBody}>
            <ValidationBanner result={validation} />
            <TranslationLangNotice
              billLang={bill.translationLang}
              onRescan={pickAndParse}
              busy={!!busy}
            />

            <Card style={styles.totalsCard}>
              <Text variant="label" tone="muted">
                {t('bill.printedTotals')}
              </Text>
              <View style={styles.totalsRow}>
                {(
                  [
                    ['net', t('bill.net')],
                    ['vatA', t('bill.vatA')],
                    ['vatB', t('bill.vatB')],
                    ['gross', t('bill.gross')],
                  ] as const
                ).map(([key, label]) => (
                  <View key={key} style={styles.flex}>
                    <Text variant="muted" tone="muted">
                      {label}
                    </Text>
                    <Input
                      value={totalsDraft[key]}
                      onChangeText={(v) =>
                        setTotalsDraft({ ...totalsDraft, [key]: v })
                      }
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      numeric
                    />
                  </View>
                ))}
              </View>
              <Button
                label={t('bill.saveAndValidate')}
                onPress={saveTotals}
                disabled={!!busy}
                fullWidth
              />
            </Card>

            <Text variant="heading" tone="display" style={styles.sectionHead}>
              {t('bill.items', { n: bill.items.length })}
            </Text>
            {bill.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onPatch={(patch: ItemPatch) =>
                  run(t('bill.saving'), () =>
                    api.patchItem(id!, item.id, patch),
                  )
                }
                onDelete={() =>
                  run(t('bill.deleting'), () => api.deleteItem(id!, item.id))
                }
              />
            ))}
            <Button
              label={t('bill.addRow')}
              variant="ghost"
              icon={Plus}
              onPress={addBlankItem}
            />

            {bill.invoiceUrl && (
              <Pressable
                style={styles.iconLine}
                onPress={() => Linking.openURL(bill.invoiceUrl!)}
              >
                <External size={16} color={color.primary} />
                <Text variant="label" tone="primary">
                  {t('bill.viewInvoice')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {shownStage === 'share' && (
          <View style={styles.stageBody}>
            <Text variant="heading" tone="display">
              {t('bill.families')}
            </Text>
            {bill.families.length === 0 && (
              <Banner tone="warning">
                <Text variant="body" style={{ color: color.accentInk }}>
                  {t('bill.noFamilies')}
                </Text>
              </Banner>
            )}
            <FamilyChips
              families={bill.families}
              onAdd={(name) =>
                run(t('bill.addingFamily'), () => api.addFamily(id!, name))
              }
              onRemove={(fid) =>
                run(t('bill.removingFamily'), () => api.removeFamily(id!, fid))
              }
            />

            <Text variant="heading" tone="display" style={styles.sectionHead}>
              {t('bill.share')}
            </Text>
            <ShareCard url={shareUrl(bill.shareToken)} title={bill.title} />

            <View style={styles.progressBlock}>
              <ProgressBar done={claimedCount} total={claimable.length} />
              <Text variant="muted" tone="muted">
                {t('bill.claimProgress', {
                  done: claimedCount,
                  total: claimable.length,
                })}
              </Text>
            </View>
          </View>
        )}

        {shownStage === 'summary' && (
          <View style={styles.stageBody}>
            {settlement ? (
              <>
                <Card style={styles.settledCard}>
                  <View style={styles.settledMascots}>
                    <ReceiptMascot size={60} pose="happy" />
                    <CoinMascot size={52} />
                  </View>
                  <Text variant="heading" style={{ color: color.sunbeamInk }}>
                    {t('bill.settled')}
                  </Text>
                </Card>
                <SettlementTable settlement={settlement} />
                <Button
                  label={
                    copied === 'summary'
                      ? t('common.copied')
                      : t('bill.copySummary')
                  }
                  variant="secondary"
                  onPress={() => void copy('summary')}
                  fullWidth
                />
                {!locked && (
                  <Button
                    label={t('bill.lock')}
                    icon={Lock}
                    onPress={() => setLockOpen(true)}
                    fullWidth
                  />
                )}
              </>
            ) : (
              <Text variant="body" tone="muted">
                {t('bill.lockHint')}
              </Text>
            )}
          </View>
        )}

        {/* 显式前进:校对/分享阶段完成后,由用户主动进入下一步(不自动跳) */}
        {canGoNext && (shownStage === 'review' || shownStage === 'share') && (
          <Button label={t('common.next')} onPress={goNext} fullWidth />
        )}
      </Screen>

      {/* 锁定确认:放在 Screen 之外(ScrollView 之外),避免 RNW 下弹层被滚动内容盖住 */}
      <Sheet
        visible={lockOpen}
        onClose={() => setLockOpen(false)}
        title={t('bill.lockConfirmTitle')}
      >
        <Text variant="body" tone="muted" style={styles.confirmBody}>
          {t('bill.lockConfirmBody')}
        </Text>
        <View style={styles.confirmActions}>
          <Button
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => setLockOpen(false)}
          />
          <Button
            label={t('bill.lockConfirm')}
            onPress={() => {
              setLockOpen(false);
              void run(t('bill.locking'), () => api.lock(id!));
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  iconLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stageBody: { gap: space.md },
  scanTax: { marginTop: space.sm },
  totalsCard: { gap: space.md },
  totalsRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1, gap: space.xs },
  sectionHead: { marginTop: space.sm },
  progressBlock: { gap: space.sm, marginTop: space.sm },
  confirmBody: { marginBottom: space.base },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  settledCard: {
    backgroundColor: color.sunbeamTint,
    borderColor: color.sunbeam,
    alignItems: 'center',
    gap: space.sm,
  },
  settledMascots: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
  },
});
