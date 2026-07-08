import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, type BillSummary } from '../lib/api';
import { clearToken, getToken } from '../lib/auth';

/** PRD E1(简版):账单列表 + 新建。未登录先走登录。 */
export default function BillListScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [title, setTitle] = useState('');
  const [taxCountry, setTaxCountry] = useState<'DE' | 'NL'>('DE');
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(() => getToken() !== null);
  const [email, setEmail] = useState('');

  const load = useCallback(() => {
    if (!getToken()) {
      setAuthed(false);
      return;
    }
    api
      .listBills()
      .then(({ bills }) => setBills(bills))
      .catch((e) => setError(String(e)));
  }, []);
  useFocusEffect(load);

  const doLogin = async () => {
    if (!email.trim()) return;
    try {
      await api.login(email.trim());
      setEmail('');
      setError(null);
      setAuthed(true);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  const logout = () => {
    clearToken();
    setAuthed(false);
    setBills([]);
  };

  if (!authed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loginTitle}>登录 AAbill</Text>
        <Text style={styles.sub}>
          开发登录:输入邮箱即可(生产将用 Google/Apple 登录)
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable style={styles.btn} onPress={doLogin}>
            <Text style={styles.btnText}>登录</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const create = async () => {
    if (!title.trim()) return;
    try {
      const bill = await api.createBill({ title: title.trim(), taxCountry });
      setTitle('');
      router.push(`/bill/${bill.id}`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.sub}>我的账单</Text>
        <Pressable onPress={logout}>
          <Text style={styles.linkText}>退出登录</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="账单标题(如 Metro 05-16)"
        />
        <Pressable
          style={styles.country}
          onPress={() => setTaxCountry(taxCountry === 'DE' ? 'NL' : 'DE')}
        >
          <Text style={styles.countryText}>{taxCountry}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={create}>
          <Text style={styles.btnText}>新建</Text>
        </Pressable>
      </View>
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={
          <Text style={styles.empty}>还没有账单,拍一张发票开始吧。</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.billRow}
            onPress={() => router.push(`/bill/${item.id}`)}
          >
            <View style={styles.flex}>
              <Text style={styles.billTitle}>{item.title}</Text>
              <Text style={styles.sub}>
                {item.taxCountry} · {item.status} ·{' '}
                {item.createdAt.slice(0, 10)}
              </Text>
            </View>
            <Text style={styles.sub}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12, backgroundColor: '#fff' },
  loginTitle: { fontSize: 22, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: { color: '#0a7', fontWeight: '600' },
  createRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
  },
  country: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
  },
  countryText: { fontWeight: '600' },
  btn: {
    backgroundColor: '#0a7',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  billTitle: { fontWeight: '600', fontSize: 16 },
  sub: { color: '#666', fontSize: 12 },
  flex: { flex: 1 },
  empty: { color: '#999', textAlign: 'center', marginTop: 48 },
  error: { color: '#b42318' },
});
