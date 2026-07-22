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
  detectedRates: ParsedReceipt['detectedRates'] = { A: '', B: '' },
): ParsedReceipt => ({
  detectedTaxCountry,
  detectedRates,
  items: [
    {
      name: 'Eier',
      nameTranslated: '鸡蛋',
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
  rates: ParsedReceipt['detectedRates'] = { A: '', B: '' },
): ReceiptParser => ({
  parseReceipt: async () => receiptFrom(detected, rates),
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

describe('税率优先取发票印刷值,国家表只作兜底', () => {
  const parseWith = async (
    detected: ParsedReceipt['detectedTaxCountry'],
    rates: ParsedReceipt['detectedRates'],
  ) => {
    const app = testApp({ parser: parserOf(detected, rates) });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));
    return j<{ taxCountry: unknown; taxRates: unknown }>(
      await app.request(req(`/bills/${bill.id}/parse`, PHOTO)),
    );
  };

  it('读出发票印刷税率 → 直接用(欧洲发票用逗号做小数点)', async () => {
    const after = await parseWith('DE', { A: '19,00', B: '7,00' });
    expect(after.taxRates).toEqual({ A: 1900, B: 700 });
  });

  it('发票税率与国家表不一致时,以发票为准 —— 表会过时,发票不会', async () => {
    const after = await parseWith('DE', { A: '20,00', B: '5,50' });
    expect(after.taxCountry).toBe('DE');
    expect(after.taxRates).toEqual({ A: 2000, B: 550 });
  });

  it('读出国家但读不出税率 → 回落到国家表', async () => {
    const after = await parseWith('NL', { A: '', B: '' });
    expect(after.taxRates).toEqual({ A: 2100, B: 900 });
  });

  it('税率是乱码 → 不猜,回落到国家表', async () => {
    const after = await parseWith('DE', { A: 'n/a', B: '???' });
    expect(after.taxRates).toEqual({ A: 1900, B: 700 });
  });

  it('国家读不出但税率读出来了 → 照样能算(税率才是算钱要的东西)', async () => {
    const after = await parseWith('UNKNOWN', { A: '21,00', B: '9,00' });
    expect(after.taxCountry).toBeNull();
    expect(after.taxRates).toEqual({ A: 2100, B: 900 });
  });

  it('都读不出 → 两者皆 null', async () => {
    const after = await parseWith('UNKNOWN', { A: '', B: '' });
    expect(after.taxCountry).toBeNull();
    expect(after.taxRates).toBeNull();
  });

  it('支持德荷之外的国家:法国税率读得出就直接用', async () => {
    const after = await parseWith('FR', { A: '20,00', B: '5,50' });
    expect(after.taxCountry).toBe('FR');
    expect(after.taxRates).toEqual({ A: 2000, B: 550 });
  });

  it('多档低税率的国家且发票没印税率 → 不替用户猜,税率留 null', async () => {
    // 法国低税率有 0.9/1.05/2.1/5.5/8.5/10/13 七档(含海外省与科西嘉),
    // 取最低会选中 0.9%,算出来的钱是错的。宁可留空让用户选。
    const after = await parseWith('FR', { A: '', B: '' });
    expect(after.taxCountry).toBe('FR');
    expect(after.taxRates).toBeNull();
  });

  it('单档低税率的国家(德国)才允许用国家表兜底', async () => {
    const after = await parseWith('DE', { A: '', B: '' });
    expect(after.taxRates).toEqual({ A: 1900, B: 700 });
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

describe('PUT /bills/:id/tax-country:多档低税率必须指明用哪档', () => {
  const setup = async () => {
    const app = testApp({ parser: parserOf('UNKNOWN') });
    const bill = await j<Obj>(await app.request(req('/bills', { title: 'M' })));
    return { app, bill };
  };

  it('只给国家而该国有多档低税率 → 400,并列出候选', async () => {
    const { app, bill } = await setup();
    const res = await app.request(
      req(`/bills/${bill.id}/tax-country`, { taxCountry: 'FR' }, 'PUT'),
    );
    expect(res.status).toBe(400);
    const body = await j<{ error: string; reducedRateOptions: number[] }>(res);
    expect(body.error).toMatch(/低税率/);
    expect(body.reducedRateOptions).toContain(550);
  });

  it('指明了用哪档 → 200', async () => {
    const { app, bill } = await setup();
    const res = await app.request(
      req(
        `/bills/${bill.id}/tax-country`,
        { taxCountry: 'FR', reducedRateBp: 550 },
        'PUT',
      ),
    );
    expect(res.status).toBe(200);
    expect((await j<{ taxRates: unknown }>(res)).taxRates).toEqual({
      A: 2000,
      B: 550,
    });
  });

  it('指定了该国没有的档位 → 400', async () => {
    const { app, bill } = await setup();
    expect(
      (
        await app.request(
          req(
            `/bills/${bill.id}/tax-country`,
            { taxCountry: 'FR', reducedRateBp: 1234 },
            'PUT',
          ),
        )
      ).status,
    ).toBe(400);
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
    const saved = await j<{ taxCountry: string; taxRates: unknown }>(res);
    expect(saved.taxCountry).toBe('NL');
    // 人工选国家 → 税率从国家表填上,否则选了也算不了钱
    expect(saved.taxRates).toEqual({ A: 2100, B: 900 });

    expect(
      (
        await app.request(
          req(`/bills/${bill.id}/tax-country`, { taxCountry: 'XX' }, 'PUT'),
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
