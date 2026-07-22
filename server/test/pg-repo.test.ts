import type { Bill } from '@aabill/api-types';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate.js';
import { createPostgresRepo } from '../src/db/pg-repo.js';
import { ownerToken, testApp } from './helpers.js';

// 部署期任务第一项(ADR 0004):Postgres 仓储替换内存实现。
// 测试用 embedded-postgres(进程级 PG,本地与 CI 同一套,无需 Docker/系统安装)。
// 数据模型按 PRD §5.3 规范化(bills/families/items/claims,外键级联)。

const PORT = 5541 + Math.floor(Math.random() * 400);
const pg = new EmbeddedPostgres({
  databaseDir: join(mkdtempSync(join(tmpdir(), 'aabill-pg-')), 'data'),
  user: 'postgres',
  password: 'pw',
  port: PORT,
  persistent: false,
});
let pool: Pool;

beforeAll(async () => {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('aabill_test');
  pool = new Pool({
    connectionString: `postgres://postgres:pw@localhost:${PORT}/aabill_test`,
  });
  // pg 要求给 pool 挂 error 监听:关库时 PG 强杀空闲连接(57P01),
  // 否则会冒泡成 unhandled error 让测试假失败(pg 官方建议)。
  pool.on('error', () => {});
  await migrate(pool);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await pg.stop();
}, 60_000);

const sampleBill = (): Bill => ({
  id: crypto.randomUUID(),
  ownerId: 'owner-1',
  title: 'Metro 05-16',
  taxCountry: 'DE',
  taxRates: { A: 1900, B: 700 },
  translationLang: 'zh',
  status: 'draft',
  createdAt: new Date().toISOString(),
  shareToken: crypto.randomUUID(),
  invoiceUrl: null,
  printedTotals: null,
  items: [],
  families: [],
  claims: [],
});

describe('migrate', () => {
  it('幂等:重复执行不报错', async () => {
    await migrate(pool);
    await migrate(pool);
  });
});

describe('PostgresBillRepo', () => {
  it('create → get:完整往返(含空子表与 null 合计)', async () => {
    const repo = createPostgresRepo(pool);
    const bill = sampleBill();
    await repo.create(bill);
    expect(await repo.get(bill.id)).toEqual(bill);
  });

  it('save:条目/家庭/认领/合计/状态全量落库,顺序保持', async () => {
    const repo = createPostgresRepo(pool);
    const bill = sampleBill();
    await repo.create(bill);

    const famA = { id: crypto.randomUUID(), name: 'Rio家', sortOrder: 0 };
    const famB = { id: crypto.randomUUID(), name: '老唐家', sortOrder: 1 };
    bill.families = [famA, famB];
    bill.items = [
      {
        id: crypto.randomUUID(),
        name: 'MC HAE.OBERKEULE',
        nameTranslated: '鸡大腿',
        qtyMilli: 2871,
        unit: 'KG',
        unitPriceMilli: 6488,
        printedLineNetCents: 1863,
        taxClass: 'B',
        isShared: false,
        source: 'ai',
      },
      {
        id: crypto.randomUUID(),
        name: 'Eier',
        nameTranslated: '鸡蛋',
        qtyMilli: 2000,
        unit: 'PG',
        unitPriceMilli: 2790,
        taxClass: 'B',
        isShared: true,
        source: 'manual',
      },
    ];
    bill.claims = [
      {
        id: crypto.randomUUID(),
        itemId: bill.items[0]!.id,
        familyId: famA.id,
        portion: 2,
        updatedAt: new Date().toISOString(),
      },
    ];
    bill.printedTotals = {
      netCents: 51721,
      vatByClass: { A: 59, B: 3599 },
      grossCents: 55379,
    };
    bill.invoiceUrl = 'https://res.cloudinary.com/x/inv.pdf';
    bill.status = 'locked';
    await repo.save(bill);

    expect(await repo.get(bill.id)).toEqual(bill);

    // 再次 save(删一行、清认领)也精确同步
    bill.items = [bill.items[1]!];
    bill.claims = [];
    await repo.save(bill);
    expect(await repo.get(bill.id)).toEqual(bill);
  });

  it('save:改税制与税率会落库(upsert 的 do update 曾漏掉这两列)', async () => {
    const repo = createPostgresRepo(pool);
    const bill = sampleBill();
    await repo.create(bill);

    // 发票印的税率与国家表不同(表会过时),必须原样存下来
    bill.taxCountry = 'FR';
    bill.taxRates = { A: 2000, B: 550 };
    await repo.save(bill);

    const reloaded = await createPostgresRepo(pool).get(bill.id);
    expect(reloaded?.taxCountry).toBe('FR');
    expect(reloaded?.taxRates).toEqual({ A: 2000, B: 550 });
  });

  it('税率未定的账单往返后仍为 null', async () => {
    const repo = createPostgresRepo(pool);
    const bill = { ...sampleBill(), taxCountry: null, taxRates: null };
    await repo.create(bill);
    const reloaded = await repo.get(bill.id);
    expect(reloaded?.taxCountry).toBeNull();
    expect(reloaded?.taxRates).toBeNull();
  });

  it('getByToken 命中;未知 token/id 返回 undefined', async () => {
    const repo = createPostgresRepo(pool);
    const bill = sampleBill();
    await repo.create(bill);
    expect((await repo.getByToken(bill.shareToken))?.id).toBe(bill.id);
    expect(await repo.getByToken('nope')).toBeUndefined();
    expect(await repo.get(crypto.randomUUID())).toBeUndefined();
  });

  it('list 包含已建账单;新 repo 实例可见旧数据(真持久化)', async () => {
    const repo = createPostgresRepo(pool);
    const bill = sampleBill();
    await repo.create(bill);
    const again = createPostgresRepo(pool);
    const listed = await again.list();
    expect(listed.some((b) => b.id === bill.id)).toBe(true);
  });
});

describe('路由全流程走 Postgres 仓储', () => {
  it('建单→加条目/家庭→认领→锁定→结算', async () => {
    const app = testApp({ repo: createPostgresRepo(pool) });
    const token = await ownerToken(app);
    const bearer = { authorization: `Bearer ${token}` };
    const post = (path: string, body: unknown, method = 'POST') =>
      new Request(`http://x${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...bearer },
        body: JSON.stringify(body),
      });
    const j = <T>(r: Response) => r.json() as Promise<T>;
    type Obj = Record<string, unknown> & { id: string };

    const bill = await j<Obj & { shareToken: string }>(
      await app.request(post('/bills', { title: 'PG流程', taxCountry: 'DE' })),
    );
    const item = await j<Obj>(
      await app.request(
        post(`/bills/${bill.id}/items`, {
          name: 'Folie',
          qtyMilli: 1000,
          unitPriceMilli: 1990,
          taxClass: 'A',
        }),
      ),
    );
    const fam = await j<Obj>(
      await app.request(post(`/bills/${bill.id}/families`, { name: '甲' })),
    );
    await app.request(
      post(
        `/share/${bill.shareToken}/claims`,
        { itemId: item.id, familyId: fam.id, portion: 1 },
        'PUT',
      ),
    );
    expect((await app.request(post(`/bills/${bill.id}/lock`, {}))).status).toBe(
      200,
    );
    const settlement = await j<{
      families: Array<{ name: string; grossCents: number }>;
      totals: { grossCents: number };
    }>(
      await app.request(
        new Request(`http://x/bills/${bill.id}/settlement`, {
          headers: bearer,
        }),
      ),
    );
    // 1.99 净 + 19% = 0.38 税 → 2.37
    expect(settlement.families).toEqual([
      expect.objectContaining({ name: '甲', grossCents: 237 }),
    ]);
    expect(settlement.totals.grossCents).toBe(237);
  });
});
