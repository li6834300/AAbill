import type { ParsedReceipt } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import type { ReceiptParser } from '../src/ai/provider.js';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

// 税制不该在"看到发票之前"就让用户选:建单时留空,识别发票时由 AI 一并读出国家,
// 读不出来才回落到人工选择。税制未知时不能校验/结算(税率无从取)。

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

const receiptFrom = (
  detectedTaxCountry: ParsedReceipt['detectedTaxCountry'],
): ParsedReceipt => ({
  detectedTaxCountry,
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

const parserOf = (
  detected: ParsedReceipt['detectedTaxCountry'],
): ReceiptParser => ({
  parseReceipt: async () => receiptFrom(detected),
});

const PHOTO = { fileBase64: 'aGk=', mimeType: 'image/jpeg' };

describe('建单时不必给税制', () => {
  it('不给 taxCountry → 201,值为 null(待识别)', async () => {
    const app = testApp();
    const res = await app.request(req('/bills', { title: 'Metro' }));
    expect(res.status).toBe(201);
    expect((await j<Obj & { taxCountry: unknown }>(res)).taxCountry).toBeNull();
  });

  it('显式给了就保留(仍兼容旧用法)', async () => {
    const app = testApp();
    const bill = await j<Obj & { taxCountry: unknown }>(
      await app.request(req('/bills', { title: 'M', taxCountry: 'NL' })),
    );
    expect(bill.taxCountry).toBe('NL');
  });
});

describe('识别发票时自动确定税制', () => {
  const setup = async (detected: ParsedReceipt['detectedTaxCountry']) => {
    const app = testApp({ parser: parserOf(detected) });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));
    return { app, bill };
  };

  it('AI 读出 DE → 账单税制变成 DE', async () => {
    const { app, bill } = await setup('DE');
    const after = await j<{ taxCountry: string }>(
      await app.request(req(`/bills/${bill.id}/parse`, PHOTO)),
    );
    expect(after.taxCountry).toBe('DE');
  });

  it('AI 读不出(UNKNOWN)→ 仍为 null,交给用户选', async () => {
    const { app, bill } = await setup('UNKNOWN');
    const after = await j<{ taxCountry: unknown }>(
      await app.request(req(`/bills/${bill.id}/parse`, PHOTO)),
    );
    expect(after.taxCountry).toBeNull();
  });

  it('用户已手动设定的税制,重新识别不覆盖', async () => {
    const app = testApp({ parser: parserOf('DE') });
    const bill = await j<Obj>(
      await app.request(req('/bills', { title: 'M', taxCountry: 'NL' })),
    );
    const after = await j<{ taxCountry: string }>(
      await app.request(req(`/bills/${bill.id}/parse`, PHOTO)),
    );
    expect(after.taxCountry).toBe('NL');
  });
});

describe('税制未知时不能校验/结算/锁定', () => {
  const setupUnknown = async () => {
    const app = testApp({ parser: parserOf('UNKNOWN') });
    const bill = await j<Obj & { shareToken: string }>(
      await app.request(req('/bills', { title: 'M' })),
    );
    await app.request(req(`/bills/${bill.id}/parse`, PHOTO));
    return { app, bill };
  };

  it('validate → 409 并提示先确定税制', async () => {
    const { app, bill } = await setupUnknown();
    const res = await app.request(
      new Request(`http://x/bills/${bill.id}/validate`, { headers: bearer }),
    );
    expect(res.status).toBe(409);
    expect((await j<{ error: string }>(res)).error).toMatch(/税制/);
  });

  it('settlement / lock → 409', async () => {
    const { app, bill } = await setupUnknown();
    expect(
      (
        await app.request(
          new Request(`http://x/bills/${bill.id}/settlement`, {
            headers: bearer,
          }),
        )
      ).status,
    ).toBe(409);
    expect((await app.request(req(`/bills/${bill.id}/lock`, {}))).status).toBe(
      409,
    );
  });
});

describe('PUT /bills/:id/tax-country(识别不出时人工指定)', () => {
  it('设置后可用;非法值 400;未知账单 404', async () => {
    const app = testApp({ parser: parserOf('UNKNOWN') });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));

    const res = await app.request(
      req(`/bills/${bill.id}/tax-country`, { taxCountry: 'NL' }, 'PUT'),
    );
    expect(res.status).toBe(200);
    expect((await j<{ taxCountry: string }>(res)).taxCountry).toBe('NL');

    expect(
      (
        await app.request(
          req(`/bills/${bill.id}/tax-country`, { taxCountry: 'FR' }, 'PUT'),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          req(`/bills/nope/tax-country`, { taxCountry: 'NL' }, 'PUT'),
        )
      ).status,
    ).toBe(404);
  });
});
