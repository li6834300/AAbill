import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';

// server 是薄壳(CLAUDE.md):路由做 IO 与校验,业务调 core。
// 仓储走接口注入,测试用内存实现(Postgres 接线是部署期任务,见 ADR 0004)。

const post = (path: string, body: unknown, init?: RequestInit) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });

function newApp() {
  return createApp({ repo: createInMemoryRepo() });
}

async function createBill(app: ReturnType<typeof newApp>) {
  const res = await app.request(post('/bills', { title: 'Metro 5-16', taxCountry: 'DE' }));
  return (await res.json()) as { id: string };
}

describe('POST /bills + GET', () => {
  it('创建 draft 账单并可按 id 取回', async () => {
    const app = newApp();
    const res = await app.request(post('/bills', { title: 'Metro 5-16', taxCountry: 'DE' }));
    expect(res.status).toBe(201);
    const bill = await res.json();
    expect(bill).toMatchObject({
      title: 'Metro 5-16',
      taxCountry: 'DE',
      status: 'draft',
      printedTotals: null,
      items: [],
      families: [],
    });

    const got = await app.request(`http://x/bills/${bill.id}`);
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual(bill);
  });

  it('列表返回摘要', async () => {
    const app = newApp();
    await createBill(app);
    await createBill(app);
    const res = await app.request('http://x/bills');
    const { bills } = await res.json();
    expect(bills).toHaveLength(2);
    expect(bills[0]).toMatchObject({ title: 'Metro 5-16', status: 'draft' });
  });

  it('非法请求体 400;未知 id 404', async () => {
    const app = newApp();
    expect((await app.request(post('/bills', { title: '', taxCountry: 'DE' }))).status).toBe(400);
    expect((await app.request('http://x/bills/nope')).status).toBe(404);
  });
});

describe('条目校对编辑(PRD A2)', () => {
  it('手动添加条目:默认值补齐,source=manual', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const res = await app.request(
      post(`/bills/${id}/items`, {
        name: '10l ARO RAPSOEL',
        qtyMilli: 1000,
        unitPriceMilli: 12490,
        taxClass: 'B',
      }),
    );
    expect(res.status).toBe(201);
    const item = await res.json();
    expect(item).toMatchObject({
      name: '10l ARO RAPSOEL',
      nameZh: '',
      unit: 'ST',
      isShared: false,
      source: 'manual',
    });
    expect(typeof item.id).toBe('string');
  });

  it('PATCH 修正字段(改价/改名/标记均摊)', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const item = await (
      await app.request(
        post(`/bills/${id}/items`, {
          name: 'Eier',
          qtyMilli: 2000,
          unitPriceMilli: 2790,
          taxClass: 'B',
        }),
      )
    ).json();

    const res = await app.request(
      new Request(`http://x/bills/${id}/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nameZh: '鸡蛋', isShared: true, unitPriceMilli: 2690 }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: 'Eier',
      nameZh: '鸡蛋',
      isShared: true,
      unitPriceMilli: 2690,
    });
  });

  it('DELETE 删行;条目不存在 404', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const item = await (
      await app.request(
        post(`/bills/${id}/items`, { name: 'x', qtyMilli: 1000, unitPriceMilli: 100, taxClass: 'A' }),
      )
    ).json();
    expect(
      (await app.request(`http://x/bills/${id}/items/${item.id}`, { method: 'DELETE' })).status,
    ).toBe(204);
    const bill = await (await app.request(`http://x/bills/${id}`)).json();
    expect(bill.items).toHaveLength(0);
    expect(
      (await app.request(`http://x/bills/${id}/items/${item.id}`, { method: 'DELETE' })).status,
    ).toBe(404);
  });
});

describe('家庭管理(PRD B2:真实名字)', () => {
  it('添加/删除家庭,sortOrder 递增', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const rio = await (await app.request(post(`/bills/${id}/families`, { name: 'Rio家' }))).json();
    const tang = await (
      await app.request(post(`/bills/${id}/families`, { name: '老唐家' }))
    ).json();
    expect(rio).toMatchObject({ name: 'Rio家', sortOrder: 0 });
    expect(tang).toMatchObject({ name: '老唐家', sortOrder: 1 });

    expect(
      (await app.request(`http://x/bills/${id}/families/${rio.id}`, { method: 'DELETE' })).status,
    ).toBe(204);
    const bill = await (await app.request(`http://x/bills/${id}`)).json();
    expect(bill.families).toEqual([tang]);
  });

  it('空名字 400', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    expect((await app.request(post(`/bills/${id}/families`, { name: '' }))).status).toBe(400);
  });
});

describe('印刷合计与 validate(PRD A4)', () => {
  it('PUT totals 后 validate 返回 core 的差额对账', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    // 1× 1.99(A) + 2× 2.79(B):net A=199 B=558;vatA=38 vatB=39;gross=834
    await app.request(
      post(`/bills/${id}/items`, { name: 'Folie', qtyMilli: 1000, unitPriceMilli: 1990, taxClass: 'A' }),
    );
    await app.request(
      post(`/bills/${id}/items`, { name: 'Eier', qtyMilli: 2000, unitPriceMilli: 2790, taxClass: 'B' }),
    );
    const put = await app.request(
      new Request(`http://x/bills/${id}/totals`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ netCents: 757, vatByClass: { A: 38, B: 39 }, grossCents: 834 }),
      }),
    );
    expect(put.status).toBe(200);

    const res = await app.request(`http://x/bills/${id}/validate`);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual({ netCents: 0, vatByClass: { A: 0, B: 0 }, grossCents: 0 });
  });

  it('尚未录入印刷合计:validate 返回 409', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    expect((await app.request(`http://x/bills/${id}/validate`)).status).toBe(409);
  });
});
