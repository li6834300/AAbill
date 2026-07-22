import { claimableUnits } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// 认领语义:portion = **实际认领的件数**(不是相对权重),各家之和不得超过商品件数。
// 计重商品(2.871kg)是一整块 → 只能认领 1 件。
// 并发场景:朋友先提交占了名额,我再提交超量 → 409 并指出是哪件、还剩多少。

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };
const j = <T>(r: Response) => r.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const req = (path: string, body?: unknown, method = 'POST', auth = true) =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? bearer : {}) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

/** 10 盒蛋(可分 10 件)+ 一块 2.871kg 牛肉(整件)+ 两个家庭 */
async function setup() {
  const app = testApp();
  const bill = await j<Obj & { shareToken: string }>(
    await app.request(req('/bills', { title: 'Metro', taxCountry: 'DE' })),
  );
  const add = async (body: Record<string, unknown>) =>
    j<Obj>(await app.request(req(`/bills/${bill.id}/items`, body)));
  const eggs = await add({
    name: '10er Eier',
    qtyMilli: 10000,
    unit: 'PG',
    unitPriceMilli: 2790,
    taxClass: 'B',
  });
  const beef = await add({
    name: 'RINDER FILET',
    qtyMilli: 2871,
    unit: 'KG',
    unitPriceMilli: 12290,
    taxClass: 'B',
  });
  const me = await j<Obj>(
    await app.request(req(`/bills/${bill.id}/families`, { name: '我家' })),
  );
  const friend = await j<Obj>(
    await app.request(req(`/bills/${bill.id}/families`, { name: '朋友家' })),
  );
  const batch = (familyId: string, claims: unknown) =>
    app.request(
      req(
        `/share/${bill.shareToken}/claims/batch`,
        { familyId, claims },
        'PUT',
        false,
      ),
    );
  return { app, bill, eggs, beef, me, friend, batch };
}

describe('claimableUnits(件数规则)', () => {
  it('整数件按件数;计重商品算 1 整件', () => {
    expect(claimableUnits(10000)).toBe(10); // 10 盒
    expect(claimableUnits(1000)).toBe(1); // 1 件
    expect(claimableUnits(3000)).toBe(3); // 3 件
    expect(claimableUnits(2871)).toBe(1); // 2.871kg 一整块
    expect(claimableUnits(500)).toBe(1); // 0.5kg 一整块
  });
});

describe('PUT /share/:token/claims/batch', () => {
  it('一次提交多件,整体替换本家庭的认领', async () => {
    const { bill, eggs, beef, me, batch, app } = await setup();
    const res = await batch(me.id, [
      { itemId: eggs.id, portion: 8 },
      { itemId: beef.id, portion: 1 },
    ]);
    expect(res.status).toBe(200);

    const view = await j<{
      claims: Array<{ itemId: string; portion: number }>;
    }>(await app.request(`http://x/share/${bill.shareToken}`));
    expect(view.claims).toHaveLength(2);
    expect(view.claims.find((c) => c.itemId === eggs.id)?.portion).toBe(8);

    // 再次提交只留 1 件 → 覆盖式替换(牛肉那条被撤掉)
    await batch(me.id, [{ itemId: eggs.id, portion: 2 }]);
    const after = await j<{ claims: Array<{ itemId: string }> }>(
      await app.request(`http://x/share/${bill.shareToken}`),
    );
    expect(after.claims).toHaveLength(1);
  });

  it('超出商品件数 → 409,指明哪件、还剩多少', async () => {
    const { eggs, me, batch } = await setup();
    const res = await batch(me.id, [{ itemId: eggs.id, portion: 11 }]);
    expect(res.status).toBe(409);
    const out = await j<{
      conflicts: Array<{
        itemId: string;
        itemName: string;
        requested: number;
        available: number;
      }>;
    }>(res);
    expect(out.conflicts).toHaveLength(1);
    expect(out.conflicts[0]).toMatchObject({
      itemId: eggs.id,
      itemName: '10er Eier',
      requested: 11,
      available: 10,
    });
  });

  it('并发场景:朋友先领 3 盒,我再领 8 盒 → 409(只剩 7)', async () => {
    const { eggs, me, friend, batch } = await setup();
    expect(
      (await batch(friend.id, [{ itemId: eggs.id, portion: 3 }])).status,
    ).toBe(200);
    const res = await batch(me.id, [{ itemId: eggs.id, portion: 8 }]);
    expect(res.status).toBe(409);
    const out = await j<{ conflicts: Array<Record<string, unknown>> }>(res);
    expect(out.conflicts[0]).toMatchObject({
      requested: 8,
      available: 7,
      claimedByOthers: 3,
    });

    // 改成 7 盒就能过
    expect((await batch(me.id, [{ itemId: eggs.id, portion: 7 }])).status).toBe(
      200,
    );
  });

  it('计重商品只能认领 1 件', async () => {
    const { beef, me, batch } = await setup();
    expect((await batch(me.id, [{ itemId: beef.id, portion: 2 }])).status).toBe(
      409,
    );
    expect((await batch(me.id, [{ itemId: beef.id, portion: 1 }])).status).toBe(
      200,
    );
  });

  it('重新提交自己的认领不算冲突(不与自己旧记录相加)', async () => {
    const { eggs, me, batch } = await setup();
    await batch(me.id, [{ itemId: eggs.id, portion: 10 }]);
    // 再提交一次同样 10 盒:自己的旧记录应被替换,而不是累加成 20
    expect(
      (await batch(me.id, [{ itemId: eggs.id, portion: 10 }])).status,
    ).toBe(200);
  });

  it('未知家庭/商品/token → 404', async () => {
    const { eggs, me, batch, app } = await setup();
    expect(
      (await batch('nope', [{ itemId: eggs.id, portion: 1 }])).status,
    ).toBe(404);
    expect((await batch(me.id, [{ itemId: 'nope', portion: 1 }])).status).toBe(
      404,
    );
    expect(
      (
        await app.request(
          req(
            `/share/wrong/claims/batch`,
            { familyId: me.id, claims: [] },
            'PUT',
            false,
          ),
        )
      ).status,
    ).toBe(404);
  });

  it('锁定后提交 → 423', async () => {
    const { bill, eggs, beef, me, batch, app } = await setup();
    await batch(me.id, [
      { itemId: eggs.id, portion: 10 },
      { itemId: beef.id, portion: 1 },
    ]);
    expect((await app.request(req(`/bills/${bill.id}/lock`, {}))).status).toBe(
      200,
    );
    expect((await batch(me.id, [{ itemId: eggs.id, portion: 5 }])).status).toBe(
      423,
    );
  });
});

describe('锁定/结算要求「件数全部认领完」', () => {
  it('只认领 8/10 盒 → 仍算未认领完,不能锁定(提示还差多少)', async () => {
    const { bill, eggs, beef, me, batch, app } = await setup();
    await batch(me.id, [
      { itemId: eggs.id, portion: 8 },
      { itemId: beef.id, portion: 1 },
    ]);
    const res = await app.request(req(`/bills/${bill.id}/lock`, {}));
    expect(res.status).toBe(409);
    const { error } = await j<{ error: string }>(res);
    expect(error).toMatch(/10er Eier/);
    expect(error).toMatch(/2/); // 还差 2 件

    // 补满 10 盒后可锁定
    await batch(me.id, [
      { itemId: eggs.id, portion: 10 },
      { itemId: beef.id, portion: 1 },
    ]);
    expect((await app.request(req(`/bills/${bill.id}/lock`, {}))).status).toBe(
      200,
    );
  });
});
