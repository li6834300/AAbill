import { describe, expect, it } from 'vitest';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };

// PRD D1/D2 / M5:
// - 全部认领完成才可锁定;锁定后 Participant 与 Owner 的修改一律拒绝(423)
// - settlement 调 core.settle:Σ家庭 gross 精确等于账单计算 gross
// - 期望值复用 core settle 测试的手算基准(甲 655 / 乙 638 / 丙 199,总 1492)

const json = <T>(res: Response) => res.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const req = (path: string, body?: unknown, method = 'POST') =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...bearer },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
const getReq = (path: string) =>
  new Request(`http://x${path}`, { headers: bearer });

/** 组一张与 core settle 手算基准一致的账单:鸡蛋均摊 + 铝箔甲独占 + 奶酪条甲1/乙2 */
async function setupBill() {
  const app = testApp();
  const bill = await json<Obj & { shareToken: string }>(
    await app.request(req('/bills', { title: 'Metro', taxCountry: 'DE' })),
  );
  const addItem = async (body: unknown) =>
    json<Obj>(await app.request(req(`/bills/${bill.id}/items`, body)));
  const eggs = await addItem({
    name: 'Eier',
    qtyMilli: 2000,
    unitPriceMilli: 2790,
    taxClass: 'B',
    isShared: true,
  });
  const folie = await addItem({
    name: 'Folie',
    qtyMilli: 1000,
    unitPriceMilli: 1990,
    taxClass: 'A',
  });
  const cheese = await addItem({
    name: 'Cheestrings',
    qtyMilli: 3000,
    unitPriceMilli: 2050,
    taxClass: 'B',
  });
  const addFam = async (name: string) =>
    json<Obj>(await app.request(req(`/bills/${bill.id}/families`, { name })));
  const jia = await addFam('甲');
  const yi = await addFam('乙');
  const bing = await addFam('丙');
  const claim = (itemId: string, familyId: string, portion: number) =>
    app.request(
      req(
        `/share/${bill.shareToken}/claims`,
        { itemId, familyId, portion },
        'PUT',
      ),
    );
  return { app, bill, eggs, folie, cheese, jia, yi, bing, claim };
}

describe('GET /bills/:id/settlement', () => {
  it('复现 bug:空账单(无家庭/条目)→ 409 而非 500', async () => {
    // 详情页每次加载都拉 settlement;新建账单尚无家庭,core.settle 会抛"家庭列表不能为空"。
    // 应作为"尚未就绪"的 409 处理,不能 500。
    const app = testApp();
    const bill = await json<{ id: string }>(
      await app.request(req('/bills', { title: '空单', taxCountry: 'DE' })),
    );
    const res = await app.request(getReq(`/bills/${bill.id}/settlement`));
    expect(res.status).toBe(409);
  });

  it('有未认领商品:409 并指明商品名', async () => {
    const { app, bill } = await setupBill();
    const res = await app.request(getReq(`/bills/${bill.id}/settlement`));
    expect(res.status).toBe(409);
    const { error } = await json<{ error: string }>(res);
    expect(error).toMatch(/Folie/);
    expect(error).toMatch(/Cheestrings/);
    expect(error).not.toMatch(/Eier/); // 均摊不算未认领
  });

  it('全认领后:每家净额/税额/含税与 core 手算基准一致,Σgross 守恒', async () => {
    const { app, bill, folie, cheese, jia, yi, claim } = await setupBill();
    await claim(folie.id, jia.id, 1);
    await claim(cheese.id, jia.id, 1);
    await claim(cheese.id, yi.id, 2);

    const res = await app.request(getReq(`/bills/${bill.id}/settlement`));
    expect(res.status).toBe(200);
    const result = await json<{
      families: Array<{
        name: string;
        netCents: number;
        vatCents: number;
        grossCents: number;
      }>;
      totals: { grossCents: number };
    }>(res);
    expect(result.families.map((f) => [f.name, f.grossCents])).toEqual([
      ['甲', 655],
      ['乙', 638],
      ['丙', 199],
    ]);
    expect(result.totals.grossCents).toBe(1492);
    expect(result.families.reduce((a, f) => a + f.grossCents, 0)).toBe(1492);
  });
});

describe('POST /bills/:id/lock', () => {
  it('未认领完:409;全认领:锁定成功,status=locked', async () => {
    const { app, bill, folie, cheese, jia, yi, claim } = await setupBill();
    expect((await app.request(req(`/bills/${bill.id}/lock`))).status).toBe(409);

    await claim(folie.id, jia.id, 1);
    await claim(cheese.id, jia.id, 1);
    await claim(cheese.id, yi.id, 2);
    const res = await app.request(req(`/bills/${bill.id}/lock`));
    expect(res.status).toBe(200);
    expect((await json<{ status: string }>(res)).status).toBe('locked');
  });

  it('锁定后:claims 423,owner 改条目/家庭/合计/重识别一律 423,settlement 仍可读', async () => {
    const { app, bill, folie, cheese, jia, yi, claim } = await setupBill();
    await claim(folie.id, jia.id, 1);
    await claim(cheese.id, jia.id, 1);
    await claim(cheese.id, yi.id, 2);
    await app.request(req(`/bills/${bill.id}/lock`));

    expect((await claim(folie.id, yi.id, 1)).status).toBe(423);
    expect(
      (
        await app.request(
          req(`/bills/${bill.id}/items/${folie.id}`, { nameZh: 'x' }, 'PATCH'),
        )
      ).status,
    ).toBe(423);
    expect(
      (
        await app.request(
          req(`/bills/${bill.id}/items`, {
            name: 'x',
            qtyMilli: 1000,
            unitPriceMilli: 100,
            taxClass: 'A',
          }),
        )
      ).status,
    ).toBe(423);
    expect(
      (await app.request(req(`/bills/${bill.id}/families`, { name: '丁' })))
        .status,
    ).toBe(423);
    expect(
      (
        await app.request(
          req(
            `/bills/${bill.id}/totals`,
            { netCents: 1, vatByClass: { A: 0, B: 0 }, grossCents: 1 },
            'PUT',
          ),
        )
      ).status,
    ).toBe(423);
    expect(
      (
        await app.request(
          req(`/bills/${bill.id}/parse`, {
            imageBase64: 'aGk=',
            mimeType: 'image/jpeg',
          }),
        )
      ).status,
    ).toBe(423);

    expect(
      (await app.request(getReq(`/bills/${bill.id}/settlement`))).status,
    ).toBe(200);
  });

  it('重复锁定:幂等返回 200', async () => {
    const { app, bill, folie, cheese, jia, yi, claim } = await setupBill();
    await claim(folie.id, jia.id, 1);
    await claim(cheese.id, jia.id, 1);
    await claim(cheese.id, yi.id, 2);
    await app.request(req(`/bills/${bill.id}/lock`));
    expect((await app.request(req(`/bills/${bill.id}/lock`))).status).toBe(200);
  });
});
