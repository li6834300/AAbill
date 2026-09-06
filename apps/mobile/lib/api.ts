import type {
  AuthUser,
  Bill,
  FamilyClaimView,
  ItemInput,
  Lang,
  Me,
  PrintedTotals,
  ShareSummary,
  TaxCountry,
} from '@aabill/api-types';
import { authHeader, setToken } from './auth';
import { t } from './i18n';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** owner 请求:自动带 JWT。/share 与 /auth 走各自的 fetch,不加鉴权头。 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...authHeader(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(body),
});

export interface BillSummary {
  id: string;
  title: string;
  taxCountry: TaxCountry | null;
  status: string;
  createdAt: string;
}

export interface SettlementResponse {
  families: Array<{
    familyId: string;
    name: string;
    netCents: number;
    vatCents: number;
    grossCents: number;
  }>;
  totals: { grossCents: number };
}

/** 分享链接(Web 直接用当前 origin;原生端配 EXPO_PUBLIC_WEB_URL) */
export const shareUrl = (token: string): string => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081');
  return `${origin}/b/${token}`;
};

/** 认领超量时服务端逐项返回的冲突 */
export interface ClaimConflict {
  itemId: string;
  itemName: string;
  requested: number;
  available: number;
  claimedByOthers: number;
}

export interface ValidateResponse {
  ok: boolean;
  computed: unknown;
  diffs: {
    netCents: number;
    vatByClass: { A: number; B: number };
    grossCents: number;
  };
}

/** OAuth id token(dev 邮箱 / Google credential)换本站 JWT,存起来。 */
async function exchangeSession(
  provider: string,
  idToken: string,
): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, idToken }),
  });
  if (!res.ok) throw new Error(t('login.failed', { status: res.status }));
  const data = (await res.json()) as { token: string; user: AuthUser };
  setToken(data.token);
  return data.user;
}

/** 登录失败时服务端的中文提示比 HTTP 码有用,优先透出。 */
function authError(data: { error?: unknown } | null, status: number): Error {
  return new Error(
    typeof data?.error === 'string'
      ? data.error
      : t('login.failed', { status }),
  );
}

/** 未验证邮箱导致的登录失败,界面据此切到"去验证"提示。 */
export class NeedsVerificationError extends Error {}

/** 邮箱+密码登录,成功即存 token。 */
async function passwordLogin(
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => null)) as {
    token: string;
    user: AuthUser;
    error?: unknown;
    needsVerification?: boolean;
  } | null;
  if (res.status === 403 && data?.needsVerification) {
    throw new NeedsVerificationError(t('verify.needed'));
  }
  if (!res.ok) throw authError(data, res.status);
  setToken(data!.token);
  return data!.user;
}

/**
 * 注册:服务端只受理并发验证信(202),**不签发 JWT** ——
 * 必须点邮件里的链接验证后才能登录。
 */
async function registerAccount(
  email: string,
  password: string,
): Promise<{ pendingVerification: true; email: string }> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => null)) as {
    error?: unknown;
    email?: string;
  } | null;
  if (!res.ok) throw authError(data, res.status);
  return { pendingVerification: true, email: data?.email ?? email };
}

export const api = {
  /** 开发登录:邮箱换 JWT(server ALLOW_DEV_LOGIN=1)。 */
  login: (email: string) => exchangeSession('dev', email),

  /** 邮箱密码注册(免费)。 */
  register: registerAccount,

  /** 邮箱密码登录。未验证会抛 NeedsVerificationError。 */
  loginWithPassword: passwordLogin,

  /** 点验证链接:换 JWT 并存起来。 */
  verifyEmail: async (token: string): Promise<AuthUser> => {
    const res = await fetch(`${BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json().catch(() => null)) as {
      token: string;
      user: AuthUser;
      error?: unknown;
    } | null;
    if (!res.ok) throw authError(data, res.status);
    setToken(data!.token);
    return data!.user;
  },

  /** 重发验证信。服务端一律 202(不泄露邮箱是否注册),故不抛错。 */
  resendVerification: async (email: string): Promise<void> => {
    await fetch(`${BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {});
  },

  /** 当前用户 + 本月额度。 */
  me: () => req<Me>('/me'),

  /** Google 登录:把 Google id token 换成本站 JWT。 */
  loginWithGoogle: (idToken: string) => exchangeSession('google', idToken),

  listBills: () => req<{ bills: BillSummary[] }>('/bills'),
  createBill: (body: { title: string }) => req<Bill>('/bills', json(body)),
  /** 发票没识别出税制时,由用户补选 */
  setTaxCountry: (id: string, taxCountry: TaxCountry, reducedRateBp?: number) =>
    req<Bill>(`/bills/${id}/tax-country`, {
      method: 'PUT',
      body: JSON.stringify({ taxCountry, reducedRateBp }),
    }),
  getBill: (id: string) => req<Bill>(`/bills/${id}`),
  /** lang 决定商品译名的语言,并记在账单上(切界面语言不重译,需重新识别) */
  parse: (id: string, fileBase64: string, mimeType: string, lang: Lang) =>
    req<Bill>(`/bills/${id}/parse`, json({ fileBase64, mimeType, lang })),
  putTotals: (id: string, totals: PrintedTotals) =>
    req<Bill>(`/bills/${id}/totals`, {
      method: 'PUT',
      body: JSON.stringify(totals),
    }),
  addItem: (id: string, item: ItemInput) =>
    req(`/bills/${id}/items`, json(item)),
  patchItem: (id: string, itemId: string, patch: Partial<ItemInput>) =>
    req(`/bills/${id}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteItem: (id: string, itemId: string) =>
    req(`/bills/${id}/items/${itemId}`, { method: 'DELETE' }),
  addFamily: (id: string, name: string) =>
    req(`/bills/${id}/families`, json({ name })),
  removeFamily: (id: string, familyId: string) =>
    req(`/bills/${id}/families/${familyId}`, { method: 'DELETE' }),
  // ---- Participant(免登录,凭 share_token + 每家 5 位口令)----
  /** 输入口令前的最小首屏:只拿标题/状态/有无家庭 */
  getShareSummary: (token: string) => req<ShareSummary>(`/share/${token}`),
  /** 凭口令进入自己那家;口令错抛错(403),由页面提示 */
  enterFamily: (token: string, code: string) =>
    req<FamilyClaimView>(`/share/${token}/enter`, json({ code })),
  /**
   * 批量提交本家认领(整体替换),凭口令定位家庭。
   * 超量时服务端返回 409 + 逐项冲突,这里转成结构化结果而不是抛错,便于页面高亮。
   */
  claimBatch: async (
    token: string,
    code: string,
    claims: Array<{ itemId: string; portion: number }>,
  ): Promise<{ ok: true } | { ok: false; conflicts: ClaimConflict[] }> => {
    const res = await fetch(`${BASE}/share/${token}/claims/batch`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, claims }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 409) {
      const data = (await res.json()) as { conflicts?: ClaimConflict[] };
      return { ok: false, conflicts: data.conflicts ?? [] };
    }
    throw new Error(`API ${res.status}: ${await res.text()}`);
  },

  /** 拍照认领:AI 建议照片里出现的商品(仅建议,需用户确认) */
  suggestClaims: (
    token: string,
    code: string,
    fileBase64: string,
    mimeType: string,
  ) =>
    req<{ suggestedItemIds: string[] }>(
      `/share/${token}/suggest-claims`,
      json({ code, fileBase64, mimeType }),
    ),

  // ---- M5 锁定与结算 ----
  lock: (id: string) => req<Bill>(`/bills/${id}/lock`, { method: 'POST' }),
  /** 未认领完时返回 null(server 409) */
  settlement: async (id: string): Promise<SettlementResponse | null> => {
    const res = await fetch(`${BASE}/bills/${id}/settlement`, {
      headers: authHeader(),
    });
    if (res.status === 409) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as SettlementResponse;
  },

  /** 未录合计时返回 null(server 409) */
  validate: async (id: string): Promise<ValidateResponse | null> => {
    const res = await fetch(`${BASE}/bills/${id}/validate`, {
      headers: authHeader(),
    });
    if (res.status === 409) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as ValidateResponse;
  },
};
