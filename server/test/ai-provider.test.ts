import { ParsedReceiptSchema } from '@aabill/api-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockParser } from '../src/ai/mock.js';
import { createOpenAIParser } from '../src/ai/openai.js';
import { selectParser } from '../src/ai/provider.js';

// PRD §5.1:AI 调用走 provider 接口;OpenAI 实现(structured outputs 强制 JSON schema),
// 测试与本地默认用 mock。密钥只在服务端。

describe('mock provider', () => {
  it('返回 schema 合法且确定性的识别结果', async () => {
    const parser = createMockParser();
    const receipt = await parser.parseReceipt({
      imageBase64: 'aGk=',
      mimeType: 'image/jpeg',
    });
    expect(() => ParsedReceiptSchema.parse(receipt)).not.toThrow();
    expect(receipt.items.length).toBeGreaterThan(0);
    const again = await parser.parseReceipt({
      imageBase64: 'aGk=',
      mimeType: 'image/jpeg',
    });
    expect(again).toEqual(receipt);
  });
});

describe('openai provider(stub fetch,不发真实请求)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const receiptJson = JSON.stringify({
    items: [
      {
        name: 'Eier',
        nameZh: '鸡蛋',
        qty: '2',
        unit: 'PG',
        unitPriceNet: '2.79',
        lineNet: '5.58',
        taxClass: 'B',
      },
    ],
    totals: { net: '5.58', vatA: '0.00', vatB: '0.39', gross: '5.97' },
  });

  it('带 API key 调 chat/completions,强制 json_schema,解析并校验输出', async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: receiptJson } }],
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const parser = createOpenAIParser({ apiKey: 'sk-test', model: 'gpt-4o' });
    const receipt = await parser.parseReceipt({
      imageBase64: 'aGk=',
      mimeType: 'image/jpeg',
    });
    expect(receipt.items[0]).toMatchObject({ name: 'Eier', lineNet: '5.58' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body) as {
      model: string;
      response_format: { type: string };
      messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    };
    expect(body.model).toBe('gpt-4o');
    expect(body.response_format.type).toBe('json_schema');
    const imagePart = body.messages
      .flatMap((m) => m.content)
      .find((p) => p.type === 'image_url');
    expect(imagePart?.image_url?.url).toBe('data:image/jpeg;base64,aGk=');
  });

  it('上游非 200 → 抛错;输出不合 schema → 抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    );
    const parser = createOpenAIParser({ apiKey: 'sk-test', model: 'gpt-4o' });
    await expect(
      parser.parseReceipt({ imageBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).rejects.toThrow(/429/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ choices: [{ message: { content: '{"items":[]}' } }] }),
      ),
    );
    await expect(
      parser.parseReceipt({ imageBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).rejects.toThrow();
  });
});

describe('selectParser:按环境选 provider', () => {
  it('无 OPENAI_API_KEY 或显式 mock → mock;有 key → openai', () => {
    expect(selectParser({}).kind).toBe('mock');
    expect(selectParser({ OPENAI_API_KEY: 'sk-x', AI_PROVIDER: 'mock' }).kind).toBe('mock');
    expect(selectParser({ OPENAI_API_KEY: 'sk-x' }).kind).toBe('openai');
  });
});
