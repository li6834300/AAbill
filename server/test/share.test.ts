import { describe, expect, it } from 'vitest';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };

// PRD C1-C4 / §5.3:分享链接 = /b/{share_token},token 不可猜测;
// 持 token 只能:读账单、写 claims。锁定后 claims 拒绝(423)。
// 轮询:MVP 每 5 秒全量拉取 claims(增量 updated_at 优化留待需要,tdd-log 004 记录)。

const json = <T>(res: Response) => res.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

// 归属 Owner 的写操作带 JWT;/share/* 是 Participant 路由,带不带 header 都不校验(此处统一带,无妨)。
const post = (path: string, body: unknown, method = 'POST') =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...bearer },
    body: JSON.stringify(body),
  });
const del = (path: string) =>
  new Request(`http://x${path}`, { method: 'DELETE', headers: bearer });

async function setup() {
  const app = testApp();
  const bill = await json<Obj & { shareToken: string }>(
    await app.request(post('/bills', { title: 'Metro', taxCountry: 'DE' })),
  );
  const item = await json<Obj>(
    await app.request(
      post(`/bills/${bill.id}/items`, {
        name: 'Eier',
        qtyMilli: 2000,
        unitPriceMilli: 2790,
        taxClass: 'B',
      }),
    ),
  );
  const rio = await json<Obj & { accessCode: string }>(
    await app.request(post(`/bills/${bill.id}/families`, { name: 'Rio家' })),
  );
  const tang = await json<Obj & { accessCode: string }>(
    await app.request(post(`/bills/${bill.id}/families`, { name: '老唐家' })),
  );
  // 凭口令批量认领(participant);读 claims 走 owner 端点
  const batch = (code: string, claims: unknown) =>
    app.request(
      post(`/share/${bill.shareToken}/claims/batch`, { code, claims }, 'PUT'),
    );
  const ownerClaims = async () =>
    (
      await json<{ claims: unknown[] }>(
        await app.request(
          new Request(`http://x/bills/${bill.id}`, { headers: bearer }),
        ),
      )
    ).claims;
  return { app, bill, item, rio, tang, batch, ownerClaims };
}

describe('shareToken', () => {
  it('建单即生成不可猜测 token,claims 初始为空', async () => {
    const { bill } = await setup();
    expect(typeof bill.shareToken).toBe('string');
    expect(bill.shareToken.length).toBeGreaterThanOrEqual(16);
    expect(bill.claims).toEqual([]);
  });
});

describe('GET /share/:token(输入口令前的最小首屏)', () => {
  // 明细在 POST /share/:token/enter 之后才可见,见 family-token.test.ts
  it('只给标题/状态/有无家庭', async () => {
    const { app, bill } = await setup();
    const res = await app.request(`http://x/share/${bill.shareToken}`);
    expect(res.status).toBe(200);
    const view = await json<Record<string, unknown>>(res);
    expect(view.title).toBe('Metro');
    expect(view.hasFamilies).toBe(true);
    expect(view.status).toBe('draft');
  });

  it('错误 token → 404', async () => {
    const { app } = await setup();
    expect((await app.request('http://x/share/wrong-token')).status).toBe(404);
  });
});

describe('owner 编辑与 claims 的一致性', () => {
  it('删条目/删家庭级联清除相关 claims', async () => {
    const { app, bill, item, rio, tang, batch, ownerClaims } = await setup();
    await batch(rio.accessCode, [{ itemId: item.id, portion: 1 }]);
    await batch(tang.accessCode, [{ itemId: item.id, portion: 1 }]);
    expect(await ownerClaims()).toHaveLength(2);

    await app.request(del(`/bills/${bill.id}/families/${rio.id}`));
    expect(await ownerClaims()).toHaveLength(1);

    await app.request(del(`/bills/${bill.id}/items/${item.id}`));
    expect(await ownerClaims()).toHaveLength(0);
  });
});
