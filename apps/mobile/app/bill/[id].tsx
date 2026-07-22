import type { Bill } from '@aabill/api-types';
import { toMilli } from '@aabill/core';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FamilyChips } from '../../components/FamilyChips';
import { ItemRow, type ItemPatch } from '../../components/ItemRow';
import {
  buildSummaryText,
  SettlementTable,
} from '../../components/SettlementTable';
import { ValidationBanner } from '../../components/ValidationBanner';
import {
  api,
  shareUrl,
  type SettlementResponse,
  type ValidateResponse,
} from '../../lib/api';
import { centsToEuro } from '../../lib/format';
import { pickInvoice } from '../../lib/pick-invoice';

const euroToCents = (text: string): number | null => {
  try {
    const milli = toMilli(text.trim());
    return milli % 10 === 0 ? milli / 10 : null; // 金额最多 2 位小数
  } catch {
    return null;
  }
};

/** PRD M3:Owner 端闭环 —— 识别、校对编辑、家庭、均摊、校验提示。 */
export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [settlement, setSettlement] = useState<SettlementResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    run('识别中(多页发票可能要 1 分钟)…', async () => {
      const picked = await pickInvoice();
      if (!picked) return;
      // 记录识别前的 AI 条目 id;每次识别都生成新 id,靠"出现新 id"判断结果已回填
      // (重新识别时条目数可能不变,故不能用数量判断)
      const beforeAiIds = new Set(
        (bill?.items ?? []).filter((i) => i.source === 'ai').map((i) => i.id),
      );
      const hasNewAiItems = async () => {
        const b = await api.getBill(id!);
        return b.items.some((i) => i.source === 'ai' && !beforeAiIds.has(i.id));
      };
      try {
        await api.parse(id!, picked.base64, picked.mimeType);
      } catch {
        // Heroku 30s 网关超时:识别很可能仍在后台完成 → 轮询等结果,别直接报错
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          if (await hasNewAiItems()) return;
        }
        throw new Error('识别超时,请稍后刷新看看,或重试');
      }
    });

  const saveTotals = () =>
    run('保存合计…', async () => {
      const net = euroToCents(totalsDraft.net);
      const vatA = euroToCents(totalsDraft.vatA);
      const vatB = euroToCents(totalsDraft.vatB);
      const gross = euroToCents(totalsDraft.gross);
      if (net === null || vatA === null || vatB === null || gross === null) {
        throw new Error('合计金额格式不对(最多两位小数)');
      }
      await api.putTotals(id!, {
        netCents: net,
        vatByClass: { A: vatA, B: vatB },
        grossCents: gross,
      });
    });

  const addBlankItem = () =>
    run('加行…', () =>
      api.addItem(id!, {
        name: '新条目',
        nameZh: '',
        qtyMilli: 1000,
        unit: 'ST',
        unitPriceMilli: 0,
        taxClass: 'B',
        isShared: false,
      }),
    );

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {bill.title}(税制 {bill.taxCountry})
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {busy && <Text style={styles.sub}>{busy}</Text>}

      <Pressable
        style={styles.primary}
        onPress={pickAndParse}
        disabled={!!busy}
      >
        <Text style={styles.primaryText}>
          {bill.items.some((i) => i.source === 'ai')
            ? '重新识别发票(覆盖 AI 条目)'
            : '上传发票识别(图片或 PDF)'}
        </Text>
      </Pressable>
      {bill.invoiceUrl && (
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(bill.invoiceUrl!)}
        >
          查看原始发票 ↗
        </Text>
      )}

      <ValidationBanner result={validation} />

      <Text style={styles.section}>发票印刷合计(€)</Text>
      <View style={styles.totalsRow}>
        {(
          [
            ['net', '净额'],
            ['vatA', 'A 税额'],
            ['vatB', 'B 税额'],
            ['gross', '含税'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.flex}>
            <Text style={styles.sub}>{label}</Text>
            <TextInput
              style={styles.input}
              value={totalsDraft[key]}
              onChangeText={(t) => setTotalsDraft({ ...totalsDraft, [key]: t })}
              placeholder="0.00"
            />
          </View>
        ))}
      </View>
      <Pressable style={styles.btn} onPress={saveTotals}>
        <Text style={styles.btnText}>保存合计并校验</Text>
      </Pressable>

      <Text style={styles.section}>条目({bill.items.length})</Text>
      {bill.items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onPatch={(patch: ItemPatch) =>
            run('保存…', () => api.patchItem(id!, item.id, patch))
          }
          onDelete={() => run('删除…', () => api.deleteItem(id!, item.id))}
        />
      ))}
      <Pressable style={styles.btn} onPress={addBlankItem}>
        <Text style={styles.btnText}>＋ 手动加行</Text>
      </Pressable>

      <Text style={styles.section}>参与家庭</Text>
      {bill.families.length === 0 && bill.items.length > 0 && (
        <Text style={styles.warnHint}>
          ⚠️ 还没添加家庭 —— 朋友打开分享链接将无法认领,请先把参与的家庭加上。
        </Text>
      )}
      <FamilyChips
        families={bill.families}
        onAdd={(name) => run('添加家庭…', () => api.addFamily(id!, name))}
        onRemove={(fid) => run('删除家庭…', () => api.removeFamily(id!, fid))}
      />

      <Text style={styles.section}>分享认领(PRD C1)</Text>
      <Text style={styles.sub} selectable>
        {shareUrl(bill.shareToken)}
      </Text>
      <Pressable style={styles.btn} onPress={() => void copy('link')}>
        <Text style={styles.btnText}>
          {copied === 'link' ? '已复制 ✓' : '复制分享链接'}
        </Text>
      </Pressable>
      <Text style={styles.sub}>
        认领进度:{claimedCount}/{claimable.length}
        {locked ? ' · 已锁定' : ''}
      </Text>

      {settlement && (
        <>
          <Text style={styles.section}>AA 汇总(PRD D2)</Text>
          <SettlementTable settlement={settlement} />
          <Pressable style={styles.btn} onPress={() => void copy('summary')}>
            <Text style={styles.btnText}>
              {copied === 'summary' ? '已复制 ✓' : '复制汇总文本'}
            </Text>
          </Pressable>
          {!locked && (
            <Pressable
              style={styles.lockBtn}
              onPress={() => run('锁定中…', () => api.lock(id!))}
            >
              <Text style={styles.primaryText}>
                锁定账单(认领与条目不可再改)
              </Text>
            </Pressable>
          )}
        </>
      )}
      {!settlement && claimable.length > 0 && (
        <Text style={styles.hint}>
          全部商品认领完成后,这里会出现 AA 汇总与锁定按钮。
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: '700' },
  section: { marginTop: 16, fontWeight: '600', color: '#333' },
  totalsRow: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginTop: 2,
  },
  primary: {
    backgroundColor: '#0a7',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  btn: { padding: 10, alignItems: 'center' },
  btnText: { color: '#0a7', fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  link: { color: '#0a7', fontWeight: '600', paddingVertical: 4 },
  error: { color: '#b42318' },
  hint: { color: '#999', fontSize: 12, marginTop: 8 },
  warnHint: { color: '#8a6d00', fontSize: 12 },
  lockBtn: {
    backgroundColor: '#b42318',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
});
