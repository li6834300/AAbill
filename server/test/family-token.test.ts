import { describe, expect, it } from 'vitest';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// Beta:每家一个 5 位数字口令。participant 打开账单分享链接后输入自己家的口令,
// 才能看/改自己那家;每件商品仍显示"还剩 N 件可领"(不暴露别家明细)。
// owner 能看到所有家的口令并分发。

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };
const j = <T>(r: Response) => r.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const post = (path: string, body?: unknown, auth = true) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? bearer : {}) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const put = (path: string, body: unknown, auth = false) =>
  new Request(`http://x${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(auth ? bearer : {}) },
    body: JSON.stringify(body),
  });

type Family = { id: string; name: string; accessCode: string };

/** 建一张有 2 家、1 个可分 10 件的商品的账单,返回 owner 视角与各家口令 */
async function setup() {
  const app = testApp();
  const bill = await j<Obj & { shareToken: string }>(
    await app.request(post('/bills', { title: 'Metro', taxCountry: 'DE' })),
  );
  const addFamily = async (name: string) =>
    j<Family>(await app.request(post(`/bills/${bill.id}/families`, { name })));
  const rio = await addFamily('Rio家');
  const tang = await addFamily('唐教授家');
  const item = await j<Obj>(
    await app.request(
      post(`/bills/${bill.id}/items`, {
        name: '10er Eier',
        qtyMilli: 10000,
        unitPriceMilli: 2790,
        taxClass: 'B',
      }),
    ),
  );
  return { app, bill, rio, tang, item };
}

describe('每家一个 5 位数字口令', () => {
  it('建家生成 5 位数字口令', async () => {
    const { rio } = await setup();
    expect(rio.accessCode).toMatch(/^\d{5}$/);
  });

  it('同一账单内各家口令不相同', async () => {
    const { rio, tang } = await setup();
    expect(rio.accessCode).not.toBe(tang.accessCode);
  });

  it('owner 取账单能看到所有家的口令(用于分发)', async () => {
    const { app, bill, rio, tang } = await setup();
    const got = await j<{ families: Family[] }>(
      await app.request(
        new Request(`http://x/bills/${bill.id}`, { headers: bearer }),
      ),
    );
    const codes = got.families.map((f) => f.accessCode).sort();
    expect(codes).toEqual([rio.accessCode, tang.accessCode].sort());
  });
});

describe('GET /share/:token 不再泄露明细', () => {
  it('只返回标题/状态/有无家庭,不含条目与家庭口令', async () => {
    const { app, bill } = await setup();
    const view = await j<Record<string, unknown>>(
      await app.request(`http://x/share/${bill.shareToken}`),
    );
    expect(view.title).toBe('Metro');
    expect(view.hasFamilies).toBe(true);
    expect(view).not.toHaveProperty('items');
    expect(view).not.toHaveProperty('families');
    expect(view).not.toHaveProperty('claims');
  });
});

describe('POST /share/:token/enter:凭口令进入自己那家', () => {
  it('口令正确 → 返回自己家 + 每件剩余可领,不含别家明细', async () => {
    const { app, bill, rio } = await setup();
    const view = await j<{
      family: { id: string; name: string };
      items: Array<{ id: string; remaining: number; myPortion: number }>;
    }>(
      await app.request(
        post(`/share/${bill.shareToken}/enter`, { code: rio.accessCode }, false),
      ),
    );
    expect(view.family).toEqual({ id: rio.id, name: 'Rio家' });
    expect(view.items[0]?.remaining).toBe(10); // 还没人领
    expect(view.items[0]?.myPortion).toBe(0);
    // 别家口令不能出现在 participant 视图里
    expect(JSON.stringify(view)).not.toContain('accessCode');
  });

  it('口令错误 → 403,不泄露账单', async () => {
    const { app, bill } = await setup();
    const res = await app.request(
      post(`/share/${bill.shareToken}/enter`, { code: '00000' }, false),
    );
    expect(res.status).toBe(403);
  });

  it('剩余量扣掉别家已领,但不显示是哪家领的', async () => {
    const { app, bill, rio, tang, item } = await setup();
    // 唐家先领 3 件
    await app.request(
      put(`/share/${bill.shareToken}/claims/batch`, {
        code: tang.accessCode,
        claims: [{ itemId: item.id, portion: 3 }],
      }),
    );
    const view = await j<{
      items: Array<{ id: string; remaining: number; myPortion: number }>;
    }>(
      await app.request(
        post(`/share/${bill.shareToken}/enter`, { code: rio.accessCode }, false),
      ),
    );
    expect(view.items[0]?.remaining).toBe(7); // 10 − 3
    expect(view.items[0]?.myPortion).toBe(0); // 别家领的不算我的
    expect(JSON.stringify(view)).not.toContain(tang.id); // 不暴露别家身份
  });
});

describe('凭口令认领(不再由客户端传 familyId)', () => {
  it('口令定位家庭,写入该家认领', async () => {
    const { app, bill, rio, item } = await setup();
    await app.request(
      put(`/share/${bill.shareToken}/claims/batch`, {
        code: rio.accessCode,
        claims: [{ itemId: item.id, portion: 4 }],
      }),
    );
    const view = await j<{ items: Array<{ myPortion: number }> }>(
      await app.request(
        post(`/share/${bill.shareToken}/enter`, { code: rio.accessCode }, false),
      ),
    );
    expect(view.items[0]?.myPortion).toBe(4);
  });

  it('口令错误 → 403,无法冒充任何家', async () => {
    const { app, bill, item } = await setup();
    const res = await app.request(
      put(`/share/${bill.shareToken}/claims/batch`, {
        code: '99999',
        claims: [{ itemId: item.id, portion: 4 }],
      }),
    );
    expect(res.status).toBe(403);
  });

  it('超出剩余量 → 409(与别家已领相加)', async () => {
    const { app, bill, rio, tang, item } = await setup();
    await app.request(
      put(`/share/${bill.shareToken}/claims/batch`, {
        code: tang.accessCode,
        claims: [{ itemId: item.id, portion: 8 }],
      }),
    );
    const res = await app.request(
      put(`/share/${bill.shareToken}/claims/batch`, {
        code: rio.accessCode,
        claims: [{ itemId: item.id, portion: 5 }], // 8+5 > 10
      }),
    );
    expect(res.status).toBe(409);
  });
});
