import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';

// PRD C1-C4 / §5.3:分享链接 = /b/{share_token},token 不可猜测;
// 持 token 只能:读账单、写 claims。锁定后 claims 拒绝(423)。
// 轮询:MVP 每 5 秒全量拉取 claims(增量 updated_at 优化留待需要,tdd-log 004 记录)。

const json = <T>(res: Response) => res.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const post = (path: string, body: unknown, method = 'POST') =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function setup() {
  const app = createApp({ repo: createInMemoryRepo() });
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
  const rio = await json<Obj>(
    await app.request(post(`/bills/${bill.id}/families`, { name: 'Rio家' })),
  );
  const tang = await json<Obj>(
    await app.request(post(`/bills/${bill.id}/families`, { name: '老唐家' })),
  );
  return { app, bill, item, rio, tang };
}

describe('shareToken', () => {
  it('建单即生成不可猜测 token,claims 初始为空', async () => {
    const { bill } = await setup();
    expect(typeof bill.shareToken).toBe('string');
    expect(bill.shareToken.length).toBeGreaterThanOrEqual(16);
    expect(bill.claims).toEqual([]);
  });
});

describe('GET /share/:token(Participant 读账单)', () => {
  it('持 token 可读条目/家庭/claims/状态', async () => {
    const { app, bill, item } = await setup();
    const res = await app.request(`http://x/share/${bill.shareToken}`);
    expect(res.status).toBe(200);
    const view = await json<{ items: Obj[]; families: Obj[]; claims: unknown[]; status: string }>(
      res,
    );
    expect(view.items[0]!.id).toBe(item.id);
    expect(view.families).toHaveLength(2);
    expect(view.claims).toEqual([]);
    expect(view.status).toBe('draft');
  });

  it('错误 token → 404', async () => {
    const { app } = await setup();
    expect((await app.request('http://x/share/wrong-token')).status).toBe(404);
  });
});

describe('PUT /share/:token/claims(认领)', () => {
  it('upsert:同 (item, family) 重复提交更新份数;portion=0 删除', async () => {
    const { app, bill, item, rio } = await setup();
    const put = (portion: number) =>
      app.request(
        post(`/share/${bill.shareToken}/claims`, { itemId: item.id, familyId: rio.id, portion }, 'PUT'),
      );

    let res = await put(1);
    expect(res.status).toBe(200);
    let { claims } = await json<{ claims: Array<Obj & { portion: number }> }>(res);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ itemId: item.id, familyId: rio.id, portion: 1 });

    res = await put(2);
    ({ claims } = await json<{ claims: Array<Obj & { portion: number }> }>(res));
    expect(claims).toHaveLength(1);
    expect(claims[0]!.portion).toBe(2);

    res = await put(0);
    ({ claims } = await json<{ claims: Array<Obj & { portion: number }> }>(res));
    expect(claims).toHaveLength(0);
  });

  it('同一商品可多家共享(C2)', async () => {
    const { app, bill, item, rio, tang } = await setup();
    await app.request(
      post(`/share/${bill.shareToken}/claims`, { itemId: item.id, familyId: rio.id, portion: 1 }, 'PUT'),
    );
    const res = await app.request(
      post(`/share/${bill.shareToken}/claims`, { itemId: item.id, familyId: tang.id, portion: 1 }, 'PUT'),
    );
    const { claims } = await json<{ claims: unknown[] }>(res);
    expect(claims).toHaveLength(2);
  });

  it('均摊商品不可认领(与 claims 互斥)→ 409', async () => {
    const { app, bill, item, rio } = await setup();
    await app.request(post(`/bills/${bill.id}/items/${item.id}`, { isShared: true }, 'PATCH'));
    const res = await app.request(
      post(`/share/${bill.shareToken}/claims`, { itemId: item.id, familyId: rio.id, portion: 1 }, 'PUT'),
    );
    expect(res.status).toBe(409);
  });

  it('未知 item/family → 404;非法 portion → 400;错误 token → 404', async () => {
    const { app, bill, item, rio } = await setup();
    const token = bill.shareToken;
    expect(
      (
        await app.request(
          post(`/share/${token}/claims`, { itemId: 'nope', familyId: rio.id, portion: 1 }, 'PUT'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          post(`/share/${token}/claims`, { itemId: item.id, familyId: 'nope', portion: 1 }, 'PUT'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          post(`/share/${token}/claims`, { itemId: item.id, familyId: rio.id, portion: 1.5 }, 'PUT'),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          post(`/share/wrong/claims`, { itemId: item.id, familyId: rio.id, portion: 1 }, 'PUT'),
        )
      ).status,
    ).toBe(404);
  });
});

describe('owner 编辑与 claims 的一致性', () => {
  it('删条目/删家庭级联清除相关 claims', async () => {
    const { app, bill, item, rio, tang } = await setup();
    const token = bill.shareToken;
    await app.request(
      post(`/share/${token}/claims`, { itemId: item.id, familyId: rio.id, portion: 1 }, 'PUT'),
    );
    await app.request(
      post(`/share/${token}/claims`, { itemId: item.id, familyId: tang.id, portion: 1 }, 'PUT'),
    );

    await app.request(
      new Request(`http://x/bills/${bill.id}/families/${rio.id}`, { method: 'DELETE' }),
    );
    let view = await json<{ claims: unknown[] }>(await app.request(`http://x/share/${token}`));
    expect(view.claims).toHaveLength(1);

    await app.request(
      new Request(`http://x/bills/${bill.id}/items/${item.id}`, { method: 'DELETE' }),
    );
    view = await json<{ claims: unknown[] }>(await app.request(`http://x/share/${token}`));
    expect(view.claims).toHaveLength(0);
  });
});
