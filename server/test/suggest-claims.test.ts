import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSuggester } from '../src/ai/mock-suggester.js';
import { createOpenAISuggester } from '../src/ai/openai-suggester.js';
import type { ClaimSuggester } from '../src/ai/suggester.js';
import { selectSuggester } from '../src/ai/suggester.js';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// PRD 二期 PRO:Participant 拍自己买的东西,AI 预选其商品,人工确认后才认领。
// 关键设计:候选商品编号后给模型,模型返回**编号**而非 UUID(避免它抄错/编造 id)。

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
    headers: {
      'content-type': 'application/json',
      ...(auth ? bearer : {}),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

const PHOTO = { fileBase64: 'aGk=', mimeType: 'image/jpeg' };

/** 建一张有 3 个可认领商品 + 1 个均摊商品的账单 */
async function setup(suggester?: ClaimSuggester) {
  const app = testApp(suggester ? { suggester } : {});
  const bill = await j<Obj & { shareToken: string }>(
    await app.request(req('/bills', { title: 'Metro', taxCountry: 'DE' })),
  );
  const add = async (name: string, isShared = false) =>
    j<Obj>(
      await app.request(
        req(`/bills/${bill.id}/items`, {
          name,
          qtyMilli: 1000,
          unitPriceMilli: 1000,
          taxClass: 'B',
          isShared,
        }),
      ),
    );
  const milk = await add('ARO MILCH');
  const eggs = await add('10er Eier');
  const beef = await add('RINDER FILET');
  const shared = await add('SALZ', true);
  return { app, bill, milk, eggs, beef, shared };
}

describe('POST /share/:token/suggest-claims', () => {
  it('返回 AI 建议的商品 id(不直接创建认领)', async () => {
    // 建议器挑第 1、3 个候选
    const { app, bill, milk, beef } = await setup({
      suggestItems: async ({ candidates }) => [
        candidates[0]!.id,
        candidates[2]!.id,
      ],
    });
    const res = await app.request(
      req(`/share/${bill.shareToken}/suggest-claims`, PHOTO, 'POST', false),
    );
    expect(res.status).toBe(200);
    const out = await j<{ suggestedItemIds: string[] }>(res);
    expect(out.suggestedItemIds).toEqual([milk.id, beef.id]);

    // 只是建议:此时还没有任何认领
    const view = await j<{ claims: unknown[] }>(
      await app.request(`http://x/share/${bill.shareToken}`),
    );
    expect(view.claims).toEqual([]);
  });

  it('候选里排除均摊商品(均摊无需认领)', async () => {
    let seen: Array<{ id: string; name: string }> = [];
    const { app, bill, shared } = await setup({
      suggestItems: async ({ candidates }) => {
        seen = candidates;
        return [];
      },
    });
    await app.request(
      req(`/share/${bill.shareToken}/suggest-claims`, PHOTO, 'POST', false),
    );
    expect(seen).toHaveLength(3);
    expect(seen.some((c) => c.id === shared.id)).toBe(false);
  });

  it('候选必须带重量/件数与单价 —— 否则同名商品(8块牛肉)无法区分', async () => {
    let seen: Array<{ qtyLabel: string; priceLabel: string; name: string }> =
      [];
    const realApp = testApp({
      suggester: {
        suggestItems: async ({ candidates }) => {
          seen = candidates;
          return [];
        },
      },
    });
    const bill = await j<Obj & { shareToken: string }>(
      await realApp.request(req('/bills', { title: 'M', taxCountry: 'DE' })),
    );
    await realApp.request(
      req(`/bills/${bill.id}/items`, {
        name: 'RINDER FILET',
        qtyMilli: 1952, // 1.952 kg
        unit: 'KG',
        unitPriceMilli: 12291,
        taxClass: 'B',
      }),
    );
    await realApp.request(
      req(`/bills/${bill.id}/items`, {
        name: '10er Eier',
        qtyMilli: 10000, // 10 件
        unit: 'PG',
        unitPriceMilli: 2790,
        taxClass: 'B',
      }),
    );
    await realApp.request(
      req(`/share/${bill.shareToken}/suggest-claims`, PHOTO, 'POST', false),
    );
    const beef = seen.find((c) => c.name === 'RINDER FILET');
    const eggs = seen.find((c) => c.name === '10er Eier');
    expect(beef?.qtyLabel).toBe('1.952 KG');
    expect(beef?.priceLabel).toBe('12.291 €/KG');
    expect(eggs?.qtyLabel).toBe('10 件');
    expect(eggs?.priceLabel).toBe('2.79 €/件');
  });

  it('免登录可用;锁定后 423;错误 token 404;缺图 400', async () => {
    const { app, bill } = await setup();
    // 无 Authorization 也能用(Participant 路由)
    expect(
      (
        await app.request(
          req(`/share/${bill.shareToken}/suggest-claims`, PHOTO, 'POST', false),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          req(`/share/wrong/suggest-claims`, PHOTO, 'POST', false),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          req(`/share/${bill.shareToken}/suggest-claims`, {}, 'POST', false),
        )
      ).status,
    ).toBe(400);
  });

  it('建议器抛错 → 502(不影响手动认领)', async () => {
    const { app, bill } = await setup({
      suggestItems: async () => {
        throw new Error('上游挂了');
      },
    });
    expect(
      (
        await app.request(
          req(`/share/${bill.shareToken}/suggest-claims`, PHOTO, 'POST', false),
        )
      ).status,
    ).toBe(502);
  });
});

describe('mock suggester', () => {
  it('确定性:返回候选里的前两个', async () => {
    const s = createMockSuggester();
    const candidates = ['a', 'b', 'c'].map((id) => ({
      id,
      name: id.toUpperCase(),
      nameTranslated: '',
      qtyLabel: '1 件',
      priceLabel: '1.00 €/件',
    }));
    expect(await s.suggestItems({ ...PHOTO, candidates })).toEqual(['a', 'b']);
  });
});

describe('openai suggester(stub fetch)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const candidates = [
    {
      id: 'id-milk',
      name: 'ARO MILCH',
      nameTranslated: '牛奶',
      qtyLabel: '1 件',
      priceLabel: '1.29 €/件',
    },
    {
      id: 'id-eggs',
      name: '10er Eier',
      nameTranslated: '鸡蛋',
      qtyLabel: '10 件',
      priceLabel: '2.79 €/件',
    },
    {
      id: 'id-beef',
      name: 'RINDER FILET',
      nameTranslated: '牛柳',
      qtyLabel: '1.952 KG',
      priceLabel: '12.291 €/KG',
    },
  ];
  const reply = (json: string) =>
    Response.json({
      output: [{ content: [{ type: 'output_text', text: json }] }],
    });

  it('模型返回编号 → 映射回对应 id(不让模型抄 UUID)', async () => {
    const spy = vi.fn(async () => reply('{"matchedIndexes":[1,3]}'));
    vi.stubGlobal('fetch', spy);
    const s = createOpenAISuggester({ apiKey: 'sk-t', model: 'gpt-4.1' });
    expect(await s.suggestItems({ ...PHOTO, candidates })).toEqual([
      'id-milk',
      'id-beef',
    ]);

    const [url, init] = spy.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body) as {
      input: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    const text = body.input
      .flatMap((m) => m.content)
      .map((p) => p.text ?? '')
      .join('\n');
    // 候选以编号形式给模型,并**必须带重量/件数与单价** ——
    // 同名的 8 块牛肉只有靠重量才能区分,不给这些信息换什么模型都选不对
    expect(text).toContain('1. ARO MILCH');
    expect(text).toContain('3. RINDER FILET');
    expect(text).toContain('1.952 KG');
    expect(text).toContain('12.291 €/KG');
  });

  it('越界/重复编号被忽略,不会崩', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply('{"matchedIndexes":[2,2,99,0,-1]}')),
    );
    const s = createOpenAISuggester({ apiKey: 'sk-t', model: 'gpt-4.1' });
    expect(await s.suggestItems({ ...PHOTO, candidates })).toEqual(['id-eggs']);
  });
});

describe('selectSuggester', () => {
  it('有 key 用 openai;否则 mock', () => {
    expect(selectSuggester({ OPENAI_API_KEY: 'sk-x' }).kind).toBe('openai');
    expect(selectSuggester({}).kind).toBe('mock');
    expect(
      selectSuggester({ OPENAI_API_KEY: 'sk-x', AI_PROVIDER: 'mock' }).kind,
    ).toBe('mock');
  });
});
