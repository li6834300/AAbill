import type {
  AuthUser,
  Bill,
  Claim,
  ClaimUpsert,
  ItemInput,
  PrintedTotals,
} from '@aabill/api-types';
import { authHeader, setToken } from './auth';

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
  taxCountry: 'DE' | 'NL';
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
  if (!res.ok) throw new Error(`登录失败 ${res.status}`);
  const data = (await res.json()) as { token: string; user: AuthUser };
  setToken(data.token);
  return data.user;
}

export const api = {
  /** 开发登录:邮箱换 JWT(server ALLOW_DEV_LOGIN=1)。 */
  login: (email: string) => exchangeSession('dev', email),

  /** Google 登录:把 Google id token 换成本站 JWT。 */
  loginWithGoogle: (idToken: string) => exchangeSession('google', idToken),

  listBills: () => req<{ bills: BillSummary[] }>('/bills'),
  createBill: (body: { title: string; taxCountry: 'DE' | 'NL' }) =>
    req<Bill>('/bills', json(body)),
  getBill: (id: string) => req<Bill>(`/bills/${id}`),
  parse: (id: string, fileBase64: string, mimeType: string) =>
    req<Bill>(`/bills/${id}/parse`, json({ fileBase64, mimeType })),
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
  // ---- Participant(免登录,凭 share_token)----
  getShare: (token: string) => req<Bill>(`/share/${token}`),
  /** 拍照认领:AI 建议照片里出现的商品(仅建议,需用户确认) */
  suggestClaims: (token: string, fileBase64: string, mimeType: string) =>
    req<{ suggestedItemIds: string[] }>(
      `/share/${token}/suggest-claims`,
      json({ fileBase64, mimeType }),
    ),
  putClaim: (token: string, claim: ClaimUpsert) =>
    req<{ claims: Claim[] }>(`/share/${token}/claims`, {
      method: 'PUT',
      body: JSON.stringify(claim),
    }),

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
