import { ParsedReceiptSchema } from '@aabill/api-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockParser } from '../src/ai/mock.js';
import { createOpenAIParser } from '../src/ai/openai.js';
import { selectParser } from '../src/ai/provider.js';

// PRD §5.1 / A1:AI 走 provider 接口,识别图片或 PDF(发票常是 PDF)。
// OpenAI 用 Responses API(/v1/responses)—— 2025-09 起 chat/completions 不再收文件输入。
// 图片走 input_image,PDF 走 input_file;structured outputs 强制 JSON schema。密钥只在服务端。

// Responses API 原始返回:output[].content[] 里 type=output_text 的 text 即模型输出
const responsesReply = (json: string) =>
  Response.json({
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: json }],
      },
    ],
  });

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

describe('mock provider', () => {
  it('返回 schema 合法且确定性的识别结果(图片或 PDF 皆可)', async () => {
    const parser = createMockParser();
    const receipt = await parser.parseReceipt({
      fileBase64: 'aGk=',
      mimeType: 'application/pdf',
    });
    expect(() => ParsedReceiptSchema.parse(receipt)).not.toThrow();
    expect(receipt.items.length).toBeGreaterThan(0);
    const again = await parser.parseReceipt({
      fileBase64: 'aGk=',
      mimeType: 'image/jpeg',
    });
    expect(again).toEqual(receipt);
  });
});

describe('openai provider — Responses API(stub fetch,不发真实请求)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const callBody = (spy: ReturnType<typeof vi.fn>) => {
    const [url, init] = spy.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    return {
      url,
      headers: init.headers,
      body: JSON.parse(init.body) as {
        model: string;
        max_output_tokens: number;
        text: { format: { type: string } };
        input: Array<{
          role: string;
          content: Array<{
            type: string;
            image_url?: string;
            file_data?: string;
            filename?: string;
          }>;
        }>;
      },
    };
  };

  it('图片:打到 /v1/responses,input_image + json_schema,解析输出', async () => {
    const spy = vi.fn(async () => responsesReply(receiptJson));
    vi.stubGlobal('fetch', spy);

    const parser = createOpenAIParser({ apiKey: 'sk-test', model: 'gpt-4o' });
    const receipt = await parser.parseReceipt({
      fileBase64: 'aGk=',
      mimeType: 'image/jpeg',
    });
    expect(receipt.items[0]).toMatchObject({ name: 'Eier', lineNet: '5.58' });

    const { url, headers, body } = callBody(spy);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(headers.authorization).toBe('Bearer sk-test');
    expect(body.model).toBe('gpt-4o');
    expect(body.max_output_tokens).toBeGreaterThanOrEqual(8000);
    expect(body.text.format.type).toBe('json_schema');
    const parts = body.input.flatMap((m) => m.content);
    const image = parts.find((p) => p.type === 'input_image');
    expect(image?.image_url).toBe('data:image/jpeg;base64,aGk=');
    expect(parts.some((p) => p.type === 'input_file')).toBe(false);
  });

  it('PDF:同一路径改用 input_file(filename + file_data data URL)', async () => {
    const spy = vi.fn(async () => responsesReply(receiptJson));
    vi.stubGlobal('fetch', spy);

    const parser = createOpenAIParser({ apiKey: 'sk-test', model: 'gpt-4o' });
    await parser.parseReceipt({
      fileBase64: 'JVBER',
      mimeType: 'application/pdf',
    });

    const { body } = callBody(spy);
    const parts = body.input.flatMap((m) => m.content);
    const file = parts.find((p) => p.type === 'input_file');
    expect(file?.file_data).toBe('data:application/pdf;base64,JVBER');
    expect(file?.filename).toMatch(/\.pdf$/);
    expect(parts.some((p) => p.type === 'input_image')).toBe(false);
  });

  it('上游非 200 → 抛错;输出不合 schema → 抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    );
    const parser = createOpenAIParser({ apiKey: 'sk-test', model: 'gpt-4o' });
    await expect(
      parser.parseReceipt({ fileBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).rejects.toThrow(/429/);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responsesReply('{"items":[]}')),
    );
    await expect(
      parser.parseReceipt({ fileBase64: 'aGk=', mimeType: 'image/jpeg' }),
    ).rejects.toThrow();
  });
});

describe('selectParser:按环境选 provider', () => {
  it('无 OPENAI_API_KEY 或显式 mock → mock;有 key → openai', () => {
    expect(selectParser({}).kind).toBe('mock');
    expect(
      selectParser({ OPENAI_API_KEY: 'sk-x', AI_PROVIDER: 'mock' }).kind,
    ).toBe('mock');
    expect(selectParser({ OPENAI_API_KEY: 'sk-x' }).kind).toBe('openai');
  });
});
