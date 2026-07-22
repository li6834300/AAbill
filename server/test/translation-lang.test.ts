import type { ParsedReceipt } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import type { ParseInput, ReceiptParser } from '../src/ai/provider.js';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// 商品译名跟着**账单**走,不跟界面语言走(用户定的方案 B):
// 识别时把目标语言传给 AI,译名与所用语言一起存进账单。
// 切界面语言不重译已有条目 —— 那要重新识别整张发票。

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };
const j = <T>(r: Response) => r.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

const req = (path: string, body?: unknown, method = 'POST') =>
  new Request(`http://x${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...bearer },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

const PHOTO = { fileBase64: 'aGk=', mimeType: 'image/jpeg' };

/** 记录 AI 收到的目标语言,并按该语言回一个可辨认的译名 */
function spyParser() {
  const seen: Array<string | undefined> = [];
  const parser: ReceiptParser = {
    parseReceipt: async (input: ParseInput) => {
      seen.push(input.lang);
      const receipt: ParsedReceipt = {
        detectedTaxCountry: 'DE',
        detectedRates: { A: '19,00', B: '7,00' },
        items: [
          {
            name: 'Eier',
            nameTranslated: `[${input.lang ?? 'none'}] eggs`,
            qty: '2',
            unit: 'PG',
            unitPriceNet: '2.79',
            lineNet: '5.58',
            taxClass: 'B',
          },
        ],
        totals: { net: '5.58', vatA: '0.00', vatB: '0.39', gross: '5.97' },
      };
      return receipt;
    },
  };
  return { parser, seen };
}

describe('识别时把目标语言传给 AI', () => {
  it('parse 请求带 lang → 透传给 provider,并记在账单上', async () => {
    const { parser, seen } = spyParser();
    const app = testApp({ parser });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));

    const after = await j<{
      translationLang: string;
      items: Array<{ nameTranslated: string }>;
    }>(await app.request(req(`/bills/${bill.id}/parse`, { ...PHOTO, lang: 'nl' })));

    expect(seen).toEqual(['nl']);
    expect(after.translationLang).toBe('nl');
    expect(after.items[0]?.nameTranslated).toBe('[nl] eggs');
  });

  it('不给 lang → 默认英文(对陌生用户最安全的回落)', async () => {
    const { parser, seen } = spyParser();
    const app = testApp({ parser });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));
    const after = await j<{ translationLang: string }>(
      await app.request(req(`/bills/${bill.id}/parse`, PHOTO)),
    );
    expect(seen).toEqual(['en']);
    expect(after.translationLang).toBe('en');
  });

  it('不支持的语言 → 400,不是悄悄回落', async () => {
    const app = testApp({ parser: spyParser().parser });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));
    const res = await app.request(
      req(`/bills/${bill.id}/parse`, { ...PHOTO, lang: 'fr' }),
    );
    expect(res.status).toBe(400);
  });

  it('换语言重新识别 → 译名与账单语言都跟着换', async () => {
    const { parser } = spyParser();
    const app = testApp({ parser });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));

    await app.request(req(`/bills/${bill.id}/parse`, { ...PHOTO, lang: 'zh' }));
    const after = await j<{
      translationLang: string;
      items: Array<{ nameTranslated: string }>;
    }>(await app.request(req(`/bills/${bill.id}/parse`, { ...PHOTO, lang: 'de' })));

    expect(after.translationLang).toBe('de');
    expect(after.items[0]?.nameTranslated).toBe('[de] eggs');
  });

  it('新建的账单还没识别过 → translationLang 为 null', async () => {
    const app = testApp({ parser: spyParser().parser });
    const bill = await j<{ translationLang: unknown }>(
      await app.request(req('/bills', { title: 'M' })),
    );
    expect(bill.translationLang).toBeNull();
  });
});
