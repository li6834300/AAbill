import {
  BillCreateSchema,
  ClaimUpsertSchema,
  ItemInputSchema,
  PrintedTotalsSchema,
  type Bill,
  type Item,
} from '@aabill/api-types';
import { DEFAULT_TAX_RATES, toMilli, validate } from '@aabill/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createMockParser } from './ai/mock.js';
import type { ReceiptParser } from './ai/provider.js';
import type { BillRepo } from './repo.js';

export interface AppDeps {
  repo: BillRepo;
  parser?: ReceiptParser;
}

const ParseBodySchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().default('image/jpeg'),
});

/** 十进制金额字符串 → 整数分(如 '18.63' → 1863) */
const toCents = (decimal: string) => toMilli(decimal) / 10;

/** 路由薄壳:IO 与 schema 校验在此,金额业务一律调 core。 */
export function createApp({ repo, parser = createMockParser() }: AppDeps) {
  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/bills', async (c) => {
    const parsed = BillCreateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const bill: Bill = {
      id: crypto.randomUUID(),
      ...parsed.data,
      status: 'draft',
      createdAt: new Date().toISOString(),
      shareToken: crypto.randomUUID(),
      printedTotals: null,
      items: [],
      families: [],
      claims: [],
    };
    return c.json(await repo.create(bill), 201);
  });

  app.get('/bills', async (c) => {
    const bills = (await repo.list()).map(
      ({ id, title, taxCountry, status, createdAt }) => ({
        id,
        title,
        taxCountry,
        status,
        createdAt,
      }),
    );
    return c.json({ bills });
  });

  /** 取账单,不存在时向 handler 报 undefined */
  const loadBill = (id: string) => repo.get(id);

  app.get('/bills/:id', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    return bill ? c.json(bill) : c.json({ error: 'bill not found' }, 404);
  });

  app.put('/bills/:id/totals', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = PrintedTotalsSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    bill.printedTotals = parsed.data;
    return c.json(await repo.save(bill));
  });

  app.post('/bills/:id/items', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = ItemInputSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const item: Item = {
      id: crypto.randomUUID(),
      source: 'manual',
      ...parsed.data,
    };
    bill.items.push(item);
    await repo.save(bill);
    return c.json(item, 201);
  });

  app.patch('/bills/:id/items/:itemId', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const item = bill.items.find((i) => i.id === c.req.param('itemId'));
    if (!item) return c.json({ error: 'item not found' }, 404);
    const parsed = ItemInputSchema.partial().safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    Object.assign(item, parsed.data);
    await repo.save(bill);
    return c.json(item);
  });

  app.delete('/bills/:id/items/:itemId', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const itemId = c.req.param('itemId');
    const before = bill.items.length;
    bill.items = bill.items.filter((i) => i.id !== itemId);
    if (bill.items.length === before)
      return c.json({ error: 'item not found' }, 404);
    bill.claims = bill.claims.filter((cl) => cl.itemId !== itemId);
    await repo.save(bill);
    return c.body(null, 204);
  });

  app.post('/bills/:id/families', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = (await c.req.json().catch(() => null)) as {
      name?: unknown;
    } | null;
    if (
      !parsed ||
      typeof parsed.name !== 'string' ||
      parsed.name.length === 0
    ) {
      return c.json({ error: 'name 不能为空' }, 400);
    }
    const family = {
      id: crypto.randomUUID(),
      name: parsed.name,
      sortOrder: bill.families.length,
    };
    bill.families.push(family);
    await repo.save(bill);
    return c.json(family, 201);
  });

  app.delete('/bills/:id/families/:familyId', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const familyId = c.req.param('familyId');
    const before = bill.families.length;
    bill.families = bill.families.filter((f) => f.id !== familyId);
    if (bill.families.length === before)
      return c.json({ error: 'family not found' }, 404);
    bill.claims = bill.claims.filter((cl) => cl.familyId !== familyId);
    await repo.save(bill);
    return c.body(null, 204);
  });

  // ---- Participant(免登录,凭 share_token;只能读账单、写 claims)----

  app.get('/share/:token', async (c) => {
    const bill = await repo.getByToken(c.req.param('token'));
    if (!bill) return c.json({ error: 'share link 无效' }, 404);
    return c.json(bill);
  });

  app.put('/share/:token/claims', async (c) => {
    const bill = await repo.getByToken(c.req.param('token'));
    if (!bill) return c.json({ error: 'share link 无效' }, 404);
    if (bill.status === 'locked')
      return c.json({ error: '账单已锁定,认领不可再修改' }, 423);
    const parsed = ClaimUpsertSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const { itemId, familyId, portion } = parsed.data;
    const item = bill.items.find((i) => i.id === itemId);
    if (!item) return c.json({ error: 'item not found' }, 404);
    if (!bill.families.some((f) => f.id === familyId))
      return c.json({ error: 'family not found' }, 404);
    if (item.isShared)
      return c.json({ error: '均摊商品由全部家庭平分,无需认领' }, 409);

    bill.claims = bill.claims.filter(
      (cl) => !(cl.itemId === itemId && cl.familyId === familyId),
    );
    if (portion > 0) {
      bill.claims.push({
        id: crypto.randomUUID(),
        itemId,
        familyId,
        portion,
        updatedAt: new Date().toISOString(),
      });
    }
    await repo.save(bill);
    return c.json({ claims: bill.claims });
  });

  app.post('/bills/:id/parse', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = ParseBodySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

    let receipt;
    try {
      receipt = await parser.parseReceipt(parsed.data);
    } catch (err) {
      return c.json({ error: `识别失败: ${String(err)}` }, 502);
    }

    // AI 输出的十进制字符串在此边界统一转整数(ADR 0003);
    // 印刷行总额存 printedLineNetCents,validate 可 0 差额对账。
    const aiItems: Item[] = receipt.items.map((it) => ({
      id: crypto.randomUUID(),
      source: 'ai',
      name: it.name,
      nameZh: it.nameZh,
      qtyMilli: toMilli(it.qty),
      unit: it.unit,
      unitPriceMilli: toMilli(it.unitPriceNet),
      printedLineNetCents: toCents(it.lineNet),
      taxClass: it.taxClass,
      isShared: false,
    }));
    bill.items = [...bill.items.filter((i) => i.source !== 'ai'), ...aiItems];
    bill.printedTotals = {
      netCents: toCents(receipt.totals.net),
      vatByClass: {
        A: toCents(receipt.totals.vatA),
        B: toCents(receipt.totals.vatB),
      },
      grossCents: toCents(receipt.totals.gross),
    };
    return c.json(await repo.save(bill));
  });

  app.get('/bills/:id/validate', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    if (!bill.printedTotals)
      return c.json({ error: '尚未录入发票印刷合计' }, 409);
    const result = validate({
      items: bill.items.map((i) => ({
        qtyMilli: i.qtyMilli,
        unitPriceMilli: i.unitPriceMilli,
        taxClass: i.taxClass,
        ...(i.printedLineNetCents !== undefined && {
          printedLineNetCents: i.printedLineNetCents,
        }),
      })),
      rates: DEFAULT_TAX_RATES[bill.taxCountry],
      printed: bill.printedTotals,
    });
    return c.json(result);
  });

  return app;
}
