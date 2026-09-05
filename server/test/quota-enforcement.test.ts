import type { ParsedReceipt } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import type { ReceiptParser } from '../src/ai/provider.js';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';
import { createInMemoryUserRepo, type UserRepo } from '../src/users.js';

// 额度卡在 AI 识别(唯一烧 OpenAI 钱的动作)。免费 2 次/月,PRO 20 次/月。
// 一个额度 = 一张账单的**首次成功**识别:重试不重扣,失败不扣。
const SECRET = 'test-secret';
const j = <T>(r: Response) => r.json() as Promise<T>;

const RECEIPT: ParsedReceipt = {
  detectedTaxCountry: 'NL',
  detectedRates: { A: '21,00', B: '9,00' },
  items: [
    {
      name: 'MELK',
      nameTranslated: '牛奶',
      qty: '1',
      unit: 'ST',
      unitPriceNet: '1.00',
      lineNet: '1.00',
      taxClass: 'B',
    },
  ],
  totals: { net: '1.00', vatA: '0.00', vatB: '0.09', gross: '1.09' },
};

const okParser: ReceiptParser = {
  async parseReceipt() {
    return RECEIPT;
  },
};
const failParser: ReceiptParser = {
  async parseReceipt() {
    throw new Error('AI 挂了');
  },
};

function makeApp(
  opts: {
    parser?: ReceiptParser;
    userRepo?: UserRepo;
    now?: () => Date;
  } = {},
) {
  return createApp({
    repo: createInMemoryRepo(),
    userRepo: opts.userRepo ?? createInMemoryUserRepo(),
    parser: opts.parser ?? okParser,
    jwtSecret: SECRET,
    ...(opts.now ? { now: opts.now } : {}),
  });
}

type App = ReturnType<typeof makeApp>;

const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

async function register(app: App, email = 'quota@example.com') {
  const res = await app.request(
    post('/auth/register', { email, password: 'goodpassword' }),
  );
  return (await j<{ token: string }>(res)).token;
}

async function newBill(app: App, token: string): Promise<string> {
  const res = await app.request(
    post('/bills', { title: 't' }, { authorization: `Bearer ${token}` }),
  );
  return (await j<{ id: string }>(res)).id;
}

const parse = (app: App, token: string, billId: string) =>
  app.request(
    post(
      `/bills/${billId}/parse`,
      { fileBase64: 'ZmFrZQ==', lang: 'zh' },
      { authorization: `Bearer ${token}` },
    ),
  );

describe('识别额度扣减', () => {
  it('免费用户前 2 次识别放行', async () => {
    const app = makeApp();
    const token = await register(app);
    for (let i = 0; i < 2; i++) {
      const res = await parse(app, token, await newBill(app, token));
      expect(res.status).toBe(200);
    }
  });

  it('免费用户第 3 次识别被拒(402)', async () => {
    const app = makeApp();
    const token = await register(app);
    for (let i = 0; i < 2; i++)
      await parse(app, token, await newBill(app, token));
    const res = await parse(app, token, await newBill(app, token));
    expect(res.status).toBe(402);
    const body = await j<{ error: string; quota?: { remaining: number } }>(res);
    expect(body.error).toContain('额度');
    expect(body.quota?.remaining).toBe(0);
  });

  // 拍糊了重识别不该受罚 —— 扣减挂在账单上,不是挂在调用次数上
  it('同一账单重复识别不重复扣减', async () => {
    const app = makeApp();
    const token = await register(app);
    const billId = await newBill(app, token);
    for (let i = 0; i < 5; i++) {
      expect((await parse(app, token, billId)).status).toBe(200);
    }
    // 只吃掉 1 个额度,还能再识别一张新单
    expect((await parse(app, token, await newBill(app, token))).status).toBe(
      200,
    );
    // 此时 2 个额度用尽,第三张单被拒
    expect((await parse(app, token, await newBill(app, token))).status).toBe(
      402,
    );
  });

  it('AI 识别失败不扣额度', async () => {
    const app = makeApp({ parser: failParser });
    const token = await register(app);
    for (let i = 0; i < 3; i++) {
      expect((await parse(app, token, await newBill(app, token))).status).toBe(
        502,
      );
    }
    const me = await j<{ quota: { used: number } }>(
      await app.request(
        new Request('http://x/me', {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    );
    expect(me.quota.used).toBe(0);
  });

  it('PRO 用户上限 20', async () => {
    const userRepo = createInMemoryUserRepo();
    const app = makeApp({ userRepo });
    const token = await register(app);
    const user = await userRepo.findByEmail('quota@example.com');
    await userRepo.save({ ...user!, plan: 'pro' });

    for (let i = 0; i < 20; i++) {
      expect((await parse(app, token, await newBill(app, token))).status).toBe(
        200,
      );
    }
    expect((await parse(app, token, await newBill(app, token))).status).toBe(
      402,
    );
  });

  it('跨月后额度重置', async () => {
    let clock = new Date('2026-09-20T10:00:00Z');
    const app = makeApp({ now: () => clock });
    const token = await register(app);
    for (let i = 0; i < 2; i++)
      await parse(app, token, await newBill(app, token));
    expect((await parse(app, token, await newBill(app, token))).status).toBe(
      402,
    );

    clock = new Date('2026-10-01T00:00:01Z'); // 次月
    expect((await parse(app, token, await newBill(app, token))).status).toBe(
      200,
    );
  });
});

describe('GET /me', () => {
  it('返回身份与额度状态', async () => {
    const app = makeApp({ now: () => new Date('2026-09-20T10:00:00Z') });
    const token = await register(app);
    await parse(app, token, await newBill(app, token));

    const res = await app.request(
      new Request('http://x/me', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const me = await j<{
      email: string;
      plan: string;
      quota: {
        limit: number;
        used: number;
        remaining: number;
        resetsAt: string;
      };
    }>(res);
    expect(me.email).toBe('quota@example.com');
    expect(me.plan).toBe('free');
    expect(me.quota).toMatchObject({ limit: 2, used: 1, remaining: 1 });
    expect(me.quota.resetsAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('未登录返回 401', async () => {
    const app = makeApp();
    expect((await app.request(new Request('http://x/me'))).status).toBe(401);
  });

  it('不外泄密码哈希', async () => {
    const app = makeApp();
    const token = await register(app);
    const raw = await (
      await app.request(
        new Request('http://x/me', {
          headers: { authorization: `Bearer ${token}` },
        }),
      )
    ).text();
    expect(raw).not.toContain('scrypt$');
    expect(raw).not.toContain('passwordHash');
  });
});
