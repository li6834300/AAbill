import { describe, expect, it } from 'vitest';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// server 是薄壳(CLAUDE.md):路由做 IO 与校验,业务调 core。
// 仓储走接口注入,测试用内存实现(Postgres 接线是部署期任务,见 ADR 0004)。
// Owner 鉴权接入后,/bills 路由需 JWT —— 下面的请求构造器统一带上。

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };

const post = (path: string, body: unknown) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...bearer },
    body: JSON.stringify(body),
  });
const send = (path: string, method: string, body?: unknown) =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...bearer },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const get = (path: string) =>
  new Request(`http://x${path}`, { headers: bearer });

const json = <T>(res: Response) => res.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const newApp = () => testApp();

async function createBill(app: ReturnType<typeof newApp>) {
  const res = await app.request(
    post('/bills', { title: 'Metro 5-16', taxCountry: 'DE' }),
  );
  return (await res.json()) as { id: string };
}

describe('POST /bills + GET', () => {
  it('创建 draft 账单并可按 id 取回', async () => {
    const app = newApp();
    const res = await app.request(
      post('/bills', { title: 'Metro 5-16', taxCountry: 'DE' }),
    );
    expect(res.status).toBe(201);
    const bill = await json<Obj>(res);
    expect(bill).toMatchObject({
      ownerId: 'alice',
      title: 'Metro 5-16',
      taxCountry: 'DE',
      status: 'draft',
      printedTotals: null,
      items: [],
      families: [],
    });

    const got = await app.request(get(`/bills/${bill.id}`));
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual(bill);
  });

  it('列表返回摘要', async () => {
    const app = newApp();
    await createBill(app);
    await createBill(app);
    const res = await app.request(get('/bills'));
    const { bills } = await json<{ bills: Obj[] }>(res);
    expect(bills).toHaveLength(2);
    expect(bills[0]).toMatchObject({ title: 'Metro 5-16', status: 'draft' });
  });

  it('非法请求体 400;未知 id 404', async () => {
    const app = newApp();
    expect(
      (await app.request(post('/bills', { title: '', taxCountry: 'DE' })))
        .status,
    ).toBe(400);
    expect((await app.request(get('/bills/nope'))).status).toBe(404);
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
    const item = await json<Obj>(res);
    expect(item).toMatchObject({
      name: '10l ARO RAPSOEL',
      nameTranslated: '',
      unit: 'ST',
      isShared: false,
      source: 'manual',
    });
    expect(typeof item.id).toBe('string');
  });

  it('PATCH 修正字段(改价/改名/标记均摊)', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const item = (await (
      await app.request(
        post(`/bills/${id}/items`, {
          name: 'Eier',
          qtyMilli: 2000,
          unitPriceMilli: 2790,
          taxClass: 'B',
        }),
      )
    ).json()) as Obj;

    const res = await app.request(
      send(`/bills/${id}/items/${item.id}`, 'PATCH', {
        nameTranslated: '鸡蛋',
        isShared: true,
        unitPriceMilli: 2690,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: 'Eier',
      nameTranslated: '鸡蛋',
      isShared: true,
      unitPriceMilli: 2690,
    });
  });

  it('复现 bug:PATCH 单个字段不得清空未提交的字段(中文名/单位/均摊)', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const item = (await (
      await app.request(
        post(`/bills/${id}/items`, {
          name: 'Eier',
          nameTranslated: '散养鸡蛋',
          qtyMilli: 2871,
          unit: 'KG',
          unitPriceMilli: 2790,
          taxClass: 'B',
          isShared: true,
        }),
      )
    ).json()) as Obj;

    // 只改单价:其余字段必须原样保留(此前 schema 默认值会把它们重置)
    const res = await app.request(
      send(`/bills/${id}/items/${item.id}`, 'PATCH', {
        unitPriceMilli: 2690,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      nameTranslated: '散养鸡蛋',
      unit: 'KG',
      isShared: true,
      unitPriceMilli: 2690,
    });
  });

  it('DELETE 删行;条目不存在 404', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const item = (await (
      await app.request(
        post(`/bills/${id}/items`, {
          name: 'x',
          qtyMilli: 1000,
          unitPriceMilli: 100,
          taxClass: 'A',
        }),
      )
    ).json()) as Obj;
    expect(
      (await app.request(send(`/bills/${id}/items/${item.id}`, 'DELETE')))
        .status,
    ).toBe(204);
    const bill = (await (await app.request(get(`/bills/${id}`))).json()) as {
      items: Obj[];
      families: Obj[];
    };
    expect(bill.items).toHaveLength(0);
    expect(
      (await app.request(send(`/bills/${id}/items/${item.id}`, 'DELETE')))
        .status,
    ).toBe(404);
  });
});

describe('家庭管理(PRD B2:真实名字)', () => {
  it('添加/删除家庭,sortOrder 递增', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    const rio = (await (
      await app.request(post(`/bills/${id}/families`, { name: 'Rio家' }))
    ).json()) as Obj;
    const tang = (await (
      await app.request(post(`/bills/${id}/families`, { name: '老唐家' }))
    ).json()) as Obj;
    expect(rio).toMatchObject({ name: 'Rio家', sortOrder: 0 });
    expect(tang).toMatchObject({ name: '老唐家', sortOrder: 1 });

    expect(
      (await app.request(send(`/bills/${id}/families/${rio.id}`, 'DELETE')))
        .status,
    ).toBe(204);
    const bill = (await (await app.request(get(`/bills/${id}`))).json()) as {
      items: Obj[];
      families: Obj[];
    };
    expect(bill.families).toEqual([tang]);
  });

  it('空名字 400', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    expect(
      (await app.request(post(`/bills/${id}/families`, { name: '' }))).status,
    ).toBe(400);
  });
});

describe('印刷合计与 validate(PRD A4)', () => {
  it('PUT totals 后 validate 返回 core 的差额对账', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    // 1× 1.99(A) + 2× 2.79(B):net A=199 B=558;vatA=38 vatB=39;gross=834
    await app.request(
      post(`/bills/${id}/items`, {
        name: 'Folie',
        qtyMilli: 1000,
        unitPriceMilli: 1990,
        taxClass: 'A',
      }),
    );
    await app.request(
      post(`/bills/${id}/items`, {
        name: 'Eier',
        qtyMilli: 2000,
        unitPriceMilli: 2790,
        taxClass: 'B',
      }),
    );
    const put = await app.request(
      send(`/bills/${id}/totals`, 'PUT', {
        netCents: 757,
        vatByClass: { A: 38, B: 39 },
        grossCents: 834,
      }),
    );
    expect(put.status).toBe(200);

    const res = await app.request(get(`/bills/${id}/validate`));
    expect(res.status).toBe(200);
    const result = await json<{ ok: boolean; diffs: unknown }>(res);
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual({
      netCents: 0,
      vatByClass: { A: 0, B: 0 },
      grossCents: 0,
    });
  });

  it('尚未录入印刷合计:validate 返回 409', async () => {
    const app = newApp();
    const { id } = await createBill(app);
    expect((await app.request(get(`/bills/${id}/validate`))).status).toBe(409);
  });
});
