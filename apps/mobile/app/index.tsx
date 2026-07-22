import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, type BillSummary } from '../lib/api';
import { LanguagePicker } from '../components/LanguagePicker';
import { useLang } from '../lib/use-lang';
import { clearToken, getToken } from '../lib/auth';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
// 配了 Google client id 且在网页端 → 用 Google 登录;否则回退开发登录(本地)。
const USE_GOOGLE = !!GOOGLE_CLIENT_ID && Platform.OS === 'web';

/** PRD E1(简版):账单列表 + 新建。未登录先走登录。 */
export default function BillListScreen() {
  const { t } = useLang();
  const router = useRouter();
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(() => getToken() !== null);
  const [email, setEmail] = useState('');
  const googleBtnRef = useRef<View>(null);

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

  const onLoggedIn = useCallback(() => {
    setEmail('');
    setError(null);
    setAuthed(true);
    load();
  }, [load]);

  const doLogin = async () => {
    if (!email.trim()) return;
    try {
      await api.login(email.trim());
      onLoggedIn();
    } catch (e) {
      setError(String(e));
    }
  };

  // Google 登录:在按钮容器里渲染 GIS 按钮,拿到 id token 后换本站 JWT。
  useEffect(() => {
    if (authed || !USE_GOOGLE) return;
    const el = googleBtnRef.current as unknown as HTMLElement | null;
    if (!el) return;
    let cancelled = false;
    import('../lib/google-web')
      .then(({ renderGoogleButton }) =>
        renderGoogleButton(el, GOOGLE_CLIENT_ID!, (idToken) => {
          api
            .loginWithGoogle(idToken)
            .then(() => !cancelled && onLoggedIn())
            .catch((e) => !cancelled && setError(String(e)));
        }),
      )
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [authed, onLoggedIn]);

  const logout = () => {
    clearToken();
    setAuthed(false);
    setBills([]);
  };

  if (!authed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.loginTitle}>{t('login.title')}</Text>
        <LanguagePicker />
        {error && <Text style={styles.error}>{error}</Text>}
        {USE_GOOGLE ? (
          <>
            <Text style={styles.sub}>{t('login.google')}</Text>
            <View ref={googleBtnRef} style={styles.googleBtn} />
          </>
        ) : (
          <>
            <Text style={styles.sub}>{t('login.devHint')}</Text>
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
                <Text style={styles.btnText}>{t('login.submit')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  const create = async () => {
    if (!title.trim()) return;
    try {
      // 税制不在这里问 —— 它印在发票上,识别时自会读出(读不出再在详情页补选)
      const bill = await api.createBill({ title: title.trim() });
      setTitle('');
      router.push(`/bill/${bill.id}`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.sub}>{t('bills.mine')}</Text>
        <LanguagePicker />
        <Pressable onPress={logout}>
          <Text style={styles.linkText}>{t('bills.logout')}</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t('bills.titlePlaceholder')}
        />
        <Pressable style={styles.btn} onPress={create}>
          <Text style={styles.btnText}>{t('bills.create')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('bills.empty')}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.billRow}
            onPress={() => router.push(`/bill/${item.id}`)}
          >
            <View style={styles.flex}>
              <Text style={styles.billTitle}>{item.title}</Text>
              <Text style={styles.sub}>
                {item.taxCountry ?? t('bills.taxPending')} · {item.status} ·{' '}
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
  googleBtn: { minHeight: 44, alignSelf: 'flex-start' },
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
