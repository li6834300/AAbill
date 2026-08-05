import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { api, type BillSummary } from '../lib/api';
import { LanguagePicker } from '../components/LanguagePicker';
import { useLang } from '../lib/use-lang';
import { clearToken, getToken } from '../lib/auth';
import { Button, Card, Input, Screen, Text } from '../components/ui';
import { ChevronRight, Receipt } from '../components/icons';
import { ReceiptMascot } from '../components/characters/ReceiptMascot';
import { color, radius, space } from '../theme/tokens';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
// 配了 Google client id 且在网页端 → 用 Google 登录;否则回退开发登录(本地)。
const USE_GOOGLE = !!GOOGLE_CLIENT_ID && Platform.OS === 'web';

const STATUS_TONE: Record<string, 'primary' | 'muted' | 'faint'> = {
  draft: 'faint',
  claiming: 'primary',
  locked: 'muted',
};

/** PRD E1(简版):账单列表 + 新建。未登录先走登录。 */
export default function BillListScreen() {
  const { t } = useLang();
  const router = useRouter();
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
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
      <Screen gap={space.lg}>
        <View style={styles.hero}>
          <ReceiptMascot size={132} />
        </View>
        <View style={styles.brandRow}>
          <View style={styles.logoDot}>
            <Receipt size={22} color={color.inkInverse} />
          </View>
          <Text variant="display" latin>
            AAbill
          </Text>
        </View>
        <Text variant="body" tone="muted" style={styles.tagline}>
          {t('login.tagline')}
        </Text>
        <LanguagePicker />
        {error && (
          <Text variant="body" tone="danger">
            {error}
          </Text>
        )}
        {USE_GOOGLE ? (
          <>
            <Text variant="muted" tone="muted">
              {t('login.google')}
            </Text>
            <View ref={googleBtnRef} style={styles.googleBtn} />
          </>
        ) : (
          <Card style={styles.loginCard}>
            <Text variant="label" tone="muted">
              {t('login.devHint')}
            </Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={doLogin}
            />
            <Button label={t('login.submit')} onPress={doLogin} fullWidth />
          </Card>
        )}
      </Screen>
    );
  }

  const create = async () => {
    if (!title.trim()) return;
    try {
      // 税制不在这里问 —— 它印在发票上,识别时自会读出(读不出再在详情页补选)
      const bill = await api.createBill({ title: title.trim() });
      setTitle('');
      setCreating(false);
      router.push(`/bill/${bill.id}`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Screen gap={space.base}>
      <View style={styles.headerRow}>
        <Text variant="heading" tone="display">
          {t('bills.mine')}
        </Text>
        <Button label={t('bills.logout')} variant="ghost" onPress={logout} />
      </View>
      <LanguagePicker />

      {error && (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      )}

      {creating ? (
        <Card style={styles.createCard}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={t('bills.titlePlaceholder')}
            autoFocus
            onSubmitEditing={create}
          />
          <View style={styles.createActions}>
            <Button
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setCreating(false);
                setTitle('');
              }}
            />
            <Button label={t('bills.create')} onPress={create} />
          </View>
        </Card>
      ) : (
        <Button
          label={t('bills.newBill')}
          icon={Receipt}
          onPress={() => setCreating(true)}
          fullWidth
        />
      )}

      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Card tone="sunk" style={styles.empty}>
            <ReceiptMascot size={88} />
            <Text variant="subhead" tone="muted" style={styles.emptyTitle}>
              {t('bills.empty')}
            </Text>
            <Text variant="muted" tone="faint" style={styles.emptyHint}>
              {t('bills.emptyHint')}
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/bill/${item.id}`)}>
            <Card style={styles.billRow}>
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.metaRow}>
                  <Text
                    variant="muted"
                    tone={STATUS_TONE[item.status] ?? 'muted'}
                  >
                    {t(`bills.status.${item.status}` as 'bills.status.draft')}
                  </Text>
                  <Text variant="muted" tone="faint">
                    {item.taxCountry ?? t('bills.taxPending')} ·{' '}
                    {item.createdAt.slice(0, 10)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={color.inkFaint} />
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logoDot: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { marginTop: -space.sm, maxWidth: 320 },
  googleBtn: { minHeight: 44, alignSelf: 'flex-start' },
  loginCard: { gap: space.md },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  createCard: { gap: space.md },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
  },
  list: { gap: space.md, paddingTop: space.xs },
  flex: { flex: 1, gap: space.xs },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyTitle: { marginTop: space.sm },
  emptyHint: { textAlign: 'center' },
});
