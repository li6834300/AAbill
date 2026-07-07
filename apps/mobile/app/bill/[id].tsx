import type { Bill } from '@aabill/api-types';
import { toMilli } from '@aabill/core';
import * as ImagePicker from 'expo-image-picker';
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
import { FamilyChips } from '../../components/FamilyChips';
import { ItemRow, type ItemPatch } from '../../components/ItemRow';
import { ValidationBanner } from '../../components/ValidationBanner';
import { api, type ValidateResponse } from '../../lib/api';
import { centsToEuro } from '../../lib/format';

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
    run('识别中…', async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        base64: true,
        quality: 0.7,
      });
      const asset = picked.assets?.[0];
      if (picked.canceled || !asset?.base64) return;
      await api.parse(id!, asset.base64, asset.mimeType ?? 'image/jpeg');
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
            : '上传发票识别'}
        </Text>
      </Pressable>

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
      <FamilyChips
        families={bill.families}
        onAdd={(name) => run('添加家庭…', () => api.addFamily(id!, name))}
        onRemove={(fid) => run('删除家庭…', () => api.removeFamily(id!, fid))}
      />
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
  error: { color: '#b42318' },
});
