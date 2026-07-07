import {
  BillCreateSchema,
  ItemInputSchema,
  PrintedTotalsSchema,
  type Bill,
  type Item,
} from '@aabill/api-types';
import { DEFAULT_TAX_RATES, validate } from '@aabill/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { BillRepo } from './repo.js';

export interface AppDeps {
  repo: BillRepo;
}

/** 路由薄壳:IO 与 schema 校验在此,金额业务一律调 core。 */
export function createApp({ repo }: AppDeps) {
  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/bills', async (c) => {
    const parsed = BillCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const bill: Bill = {
      id: crypto.randomUUID(),
      ...parsed.data,
      status: 'draft',
      createdAt: new Date().toISOString(),
      printedTotals: null,
      items: [],
      families: [],
    };
    return c.json(await repo.create(bill), 201);
  });

  app.get('/bills', async (c) => {
    const bills = (await repo.list()).map(({ id, title, taxCountry, status, createdAt }) => ({
      id,
      title,
      taxCountry,
      status,
      createdAt,
    }));
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
    const parsed = PrintedTotalsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    bill.printedTotals = parsed.data;
    return c.json(await repo.save(bill));
  });

  app.post('/bills/:id/items', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = ItemInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const item: Item = { id: crypto.randomUUID(), source: 'manual', ...parsed.data };
    bill.items.push(item);
    await repo.save(bill);
    return c.json(item, 201);
  });

  app.patch('/bills/:id/items/:itemId', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const item = bill.items.find((i) => i.id === c.req.param('itemId'));
    if (!item) return c.json({ error: 'item not found' }, 404);
    const parsed = ItemInputSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    Object.assign(item, parsed.data);
    await repo.save(bill);
    return c.json(item);
  });

  app.delete('/bills/:id/items/:itemId', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const before = bill.items.length;
    bill.items = bill.items.filter((i) => i.id !== c.req.param('itemId'));
    if (bill.items.length === before) return c.json({ error: 'item not found' }, 404);
    await repo.save(bill);
    return c.body(null, 204);
  });

  app.post('/bills/:id/families', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    if (!parsed || typeof parsed.name !== 'string' || parsed.name.length === 0) {
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
    const before = bill.families.length;
    bill.families = bill.families.filter((f) => f.id !== c.req.param('familyId'));
    if (bill.families.length === before) return c.json({ error: 'family not found' }, 404);
    await repo.save(bill);
    return c.body(null, 204);
  });

  app.get('/bills/:id/validate', async (c) => {
    const bill = await loadBill(c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    if (!bill.printedTotals) return c.json({ error: '尚未录入发票印刷合计' }, 409);
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
