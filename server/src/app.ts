import {
  BillCreateSchema,
  ClaimBatchSchema,
  ClaimUpsertSchema,
  claimableUnits,
  ItemInputSchema,
  ItemPatchSchema,
  PrintedTotalsSchema,
  SessionRequestSchema,
  type AuthUser,
  type Bill,
  type Item,
} from '@aabill/api-types';
import { DEFAULT_TAX_RATES, settle, toMilli, validate } from '@aabill/core';
import { Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createMockParser } from './ai/mock.js';
import { createMockSuggester } from './ai/mock-suggester.js';
import type { ClaimSuggester } from './ai/suggester.js';
import type { ReceiptParser } from './ai/provider.js';
import { issueToken, verifyToken } from './auth/jwt.js';
import {
  createUnconfiguredVerifier,
  type IdentityVerifier,
} from './auth/verifier.js';
import type { BillRepo } from './repo.js';
import { createNullStore, type FileStore } from './storage/file-store.js';

export interface AppDeps {
  repo: BillRepo;
  parser?: ReceiptParser;
  verifier?: IdentityVerifier;
  jwtSecret?: string;
  fileStore?: FileStore;
  suggester?: ClaimSuggester;
}

// Owner 路由把已鉴权用户挂在 context 上
type Env = { Variables: { user: AuthUser } };

const ParseBodySchema = z.object({
  fileBase64: z.string().min(1),
  // 发票是图片或 PDF(PRD A1);其余类型拒绝
  mimeType: z
    .string()
    .default('image/jpeg')
    .refine(
      (m) => m.startsWith('image/') || m === 'application/pdf',
      '仅支持图片或 PDF',
    ),
});

/** 十进制金额字符串 → 整数分(如 '18.63' → 1863) */
const toCents = (decimal: string) => toMilli(decimal) / 10;

/** 某商品已被认领的件数(各家之和) */
const claimedUnits = (bill: Bill, itemId: string): number =>
  bill.claims
    .filter((cl) => cl.itemId === itemId)
    .reduce((sum, cl) => sum + cl.portion, 0);

/**
 * 尚未认领满的商品(PRD D1:全部认领完成才可锁定/结算)。
 * portion 是**实际件数**,所以"认领完"= 各家件数之和 == 商品件数,
 * 只领了 8/10 盒也算没完 —— 否则 settle 会把 8 盒的人按 10 盒摊,金额是错的。
 */
const unclaimedNames = (bill: Bill): string[] =>
  bill.items
    .filter((i) => !i.isShared)
    .map((i) => ({ i, missing: claimableUnits(i.qtyMilli) - claimedUnits(bill, i.id) }))
    .filter(({ missing }) => missing > 0)
    .map(({ i, missing }) => `${i.name}(还差 ${missing} 件)`);

const LOCKED_MSG = '账单已锁定,不可再修改';

/** 路由薄壳:IO 与 schema 校验在此,金额业务一律调 core。 */
export function createApp({
  repo,
  parser = createMockParser(),
  verifier = createUnconfiguredVerifier(),
  jwtSecret = 'dev-insecure-secret',
  fileStore = createNullStore(),
  suggester = createMockSuggester(),
}: AppDeps) {
  const app = new Hono<Env>();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  // OAuth id token → 应用 JWT(PRD §5.3)。校验交给 verifier(Google/Apple/dev)。
  app.post('/auth/session', async (c) => {
    const parsed = SessionRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    let identity;
    try {
      identity = await verifier.verify(
        parsed.data.provider,
        parsed.data.idToken,
      );
    } catch (err) {
      // 只记失败原因,不记 token(排障用)
      console.warn(
        `auth/session 校验失败 (provider=${parsed.data.provider}): ${String(err)}`,
      );
      return c.json({ error: '登录校验失败' }, 401);
    }
    const user: AuthUser = { sub: identity.sub, email: identity.email };
    return c.json({ token: await issueToken(user, jwtSecret), user });
  });

  // Owner 鉴权:/bills 全部路由需有效 JWT(Participant 走 /share/*,不经此)
  const requireOwner: MiddlewareHandler<Env> = async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? await verifyToken(token, jwtSecret) : null;
    if (!user) return c.json({ error: '需要登录' }, 401);
    c.set('user', user);
    await next();
  };
  app.use('/bills', requireOwner);
  app.use('/bills/*', requireOwner);

  // 锁定守卫(PRD D1):锁定后 Owner 的一切修改拒绝;/lock 除外(幂等)
  app.use('/bills/:id/*', async (c, next) => {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method);
    if (isWrite && !c.req.path.endsWith('/lock')) {
      const bill = await repo.get(c.req.param('id'));
      if (bill?.status === 'locked') return c.json({ error: LOCKED_MSG }, 423);
    }
    await next();
  });

  app.post('/bills', async (c) => {
    const parsed = BillCreateSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const bill: Bill = {
      id: crypto.randomUUID(),
      ownerId: c.get('user').sub,
      ...parsed.data,
      status: 'draft',
      createdAt: new Date().toISOString(),
      shareToken: crypto.randomUUID(),
      invoiceUrl: null,
      printedTotals: null,
      items: [],
      families: [],
      claims: [],
    };
    return c.json(await repo.create(bill), 201);
  });

  app.get('/bills', async (c) => {
    const ownerId = c.get('user').sub;
    const bills = (await repo.list())
      .filter((b) => b.ownerId === ownerId)
      .map(({ id, title, taxCountry, status, createdAt }) => ({
        id,
        title,
        taxCountry,
        status,
        createdAt,
      }));
    return c.json({ bills });
  });

  /** 取自己的账单;不存在或不属于当前 owner 都当 undefined(不泄露存在性) */
  const loadBill = async (c: { get: (k: 'user') => AuthUser }, id: string) => {
    const bill = await repo.get(id);
    return bill && bill.ownerId === c.get('user').sub ? bill : undefined;
  };

  app.get('/bills/:id', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
    return bill ? c.json(bill) : c.json({ error: 'bill not found' }, 404);
  });

  app.put('/bills/:id/totals', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const parsed = PrintedTotalsSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    bill.printedTotals = parsed.data;
    return c.json(await repo.save(bill));
  });

  app.post('/bills/:id/items', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
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
    const bill = await loadBill(c, c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    const item = bill.items.find((i) => i.id === c.req.param('itemId'));
    if (!item) return c.json({ error: 'item not found' }, 404);
    // 必须用不带默认值的 patch schema:partial() 会给未提交字段补默认值,
    // 从而清空中文名 / 重置单位 / 取消均摊(见 bills.test 的复现用例)
    const parsed = ItemPatchSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    Object.assign(item, parsed.data);
    await repo.save(bill);
    return c.json(item);
  });

  app.delete('/bills/:id/items/:itemId', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
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
    const bill = await loadBill(c, c.req.param('id'));
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
    const bill = await loadBill(c, c.req.param('id'));
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

  // 拍照认领建议(PRD 二期 PRO):只返回建议,不直接写 claims —— 由用户确认后再认领
  app.post('/share/:token/suggest-claims', async (c) => {
    const bill = await repo.getByToken(c.req.param('token'));
    if (!bill) return c.json({ error: 'share link 无效' }, 404);
    if (bill.status === 'locked')
      return c.json({ error: '账单已锁定,认领不可再修改' }, 423);
    const parsed = ParseBodySchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

    // 均摊商品由全部家庭平分,不参与认领,故不作候选
    const candidates = bill.items
      .filter((i) => !i.isShared)
      .map((i) => ({ id: i.id, name: i.name, nameZh: i.nameZh }));

    try {
      const suggestedItemIds = await suggester.suggestItems({
        fileBase64: parsed.data.fileBase64,
        mimeType: parsed.data.mimeType,
        candidates,
      });
      return c.json({ suggestedItemIds });
    } catch (err) {
      return c.json({ error: `识别失败: ${String(err)}` }, 502);
    }
  });

  /**
   * 批量提交某家庭的认领:整体替换该家庭在本账单的所有认领。
   * 校验 portion(件数)之和不超过商品件数;超量返回 409 并逐项说明,
   * 用于"朋友先领了、我再领就超了"的并发场景。
   */
  app.put('/share/:token/claims/batch', async (c) => {
    const bill = await repo.getByToken(c.req.param('token'));
    if (!bill) return c.json({ error: 'share link 无效' }, 404);
    if (bill.status === 'locked')
      return c.json({ error: '账单已锁定,认领不可再修改' }, 423);
    const parsed = ClaimBatchSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
    const { familyId, claims } = parsed.data;
    if (!bill.families.some((f) => f.id === familyId))
      return c.json({ error: 'family not found' }, 404);

    const conflicts: Array<{
      itemId: string;
      itemName: string;
      requested: number;
      available: number;
      claimedByOthers: number;
    }> = [];
    for (const { itemId, portion } of claims) {
      const item = bill.items.find((i) => i.id === itemId);
      if (!item) return c.json({ error: `item not found: ${itemId}` }, 404);
      if (item.isShared)
        return c.json({ error: '均摊商品由全部家庭平分,无需认领' }, 409);
      // 只和「别家」的认领相加:重新提交自己的认领是替换,不是累加
      const claimedByOthers = bill.claims
        .filter((cl) => cl.itemId === itemId && cl.familyId !== familyId)
        .reduce((s, cl) => s + cl.portion, 0);
      const available = claimableUnits(item.qtyMilli) - claimedByOthers;
      if (portion > available) {
        conflicts.push({
          itemId,
          itemName: item.name,
          requested: portion,
          available,
          claimedByOthers,
        });
      }
    }
    if (conflicts.length > 0) {
      return c.json(
        { error: '有商品认领数量超出剩余可认领量', conflicts },
        409,
      );
    }

    const now = new Date().toISOString();
    bill.claims = [
      ...bill.claims.filter((cl) => cl.familyId !== familyId),
      ...claims.map(({ itemId, portion }) => ({
        id: crypto.randomUUID(),
        itemId,
        familyId,
        portion,
        updatedAt: now,
      })),
    ];
    await repo.save(bill);
    return c.json({ claims: bill.claims });
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
    // 件数校验:与别家已领的相加不得超过商品件数
    const others = bill.claims
      .filter((cl) => cl.itemId === itemId && cl.familyId !== familyId)
      .reduce((s, cl) => s + cl.portion, 0);
    const available = claimableUnits(item.qtyMilli) - others;
    if (portion > available) {
      return c.json(
        { error: `超出可认领件数,还剩 ${available} 件`, available },
        409,
      );
    }

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
    const bill = await loadBill(c, c.req.param('id'));
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

    // 存原始发票供回看(PRD §5.4)。存储失败不阻断识别 —— 存图是次要功能。
    try {
      const url = await fileStore.save(parsed.data);
      if (url) bill.invoiceUrl = url;
    } catch (err) {
      console.warn('发票存储失败(继续识别):', String(err));
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

  app.post('/bills/:id/lock', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    if (bill.families.length === 0 || bill.items.length === 0) {
      return c.json({ error: '账单尚未就绪(需先添加家庭与条目)' }, 409);
    }
    const unclaimed = unclaimedNames(bill);
    if (unclaimed.length > 0) {
      return c.json(
        { error: `尚有未认领商品: ${unclaimed.join('、')}`, unclaimed },
        409,
      );
    }
    bill.status = 'locked';
    return c.json(await repo.save(bill));
  });

  app.get('/bills/:id/settlement', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
    if (!bill) return c.json({ error: 'bill not found' }, 404);
    // 尚未就绪(无家庭或无条目)→ 409;详情页会据此隐藏汇总,不能让 core.settle 抛错 500
    if (bill.families.length === 0 || bill.items.length === 0) {
      return c.json({ error: '账单尚未就绪(需先添加家庭与条目)' }, 409);
    }
    const unclaimed = unclaimedNames(bill);
    if (unclaimed.length > 0) {
      return c.json(
        { error: `尚有未认领商品: ${unclaimed.join('、')}`, unclaimed },
        409,
      );
    }
    const result = settle({
      items: bill.items.map((i) => ({
        name: i.name,
        qtyMilli: i.qtyMilli,
        unitPriceMilli: i.unitPriceMilli,
        taxClass: i.taxClass,
        ...(i.printedLineNetCents !== undefined && {
          printedLineNetCents: i.printedLineNetCents,
        }),
        ...(i.isShared
          ? { isShared: true }
          : {
              claims: bill.claims
                .filter((cl) => cl.itemId === i.id)
                .map((cl) => ({ familyId: cl.familyId, portion: cl.portion })),
            }),
      })),
      families: bill.families.map((f) => f.id),
      rates: DEFAULT_TAX_RATES[bill.taxCountry],
    });
    const nameById = new Map(bill.families.map((f) => [f.id, f.name]));
    return c.json({
      families: result.families.map((f) => ({
        ...f,
        name: nameById.get(f.familyId) ?? f.familyId,
      })),
      totals: result.totals,
    });
  });

  app.get('/bills/:id/validate', async (c) => {
    const bill = await loadBill(c, c.req.param('id'));
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
