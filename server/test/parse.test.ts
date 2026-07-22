import type { ParsedReceipt } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import type { ReceiptParser } from '../src/ai/provider.js';
import { issueToken } from '../src/auth/jwt.js';
import { TEST_SECRET, testApp } from './helpers.js';

const TOKEN = await issueToken(
  { sub: 'alice', email: 'alice@example.com' },
  TEST_SECRET,
);
const bearer = { authorization: `Bearer ${TOKEN}` };

// PRD A1/§5.4:POST /bills/:id/parse → provider 识别 → 条目写入(source=ai)+ 印刷合计入库。
// AI 输出是十进制字符串,server 边界转成整数分/千分位;印刷行总额(Wert)存 printedLineNetCents,
// 使 validate 可 0 差额对账(ADR 0003)。

const RECEIPT: ParsedReceipt = {
  detectedTaxCountry: 'DE',
  detectedRates: { A: '19,00', B: '7,00' },
  items: [
    {
      name: '10mx30cm KRAFT-ALUFOLIE',
      nameZh: '铝箔纸',
      qty: '1',
      unit: 'ST',
      unitPriceNet: '1.99',
      lineNet: '1.99',
      taxClass: 'A',
    },
    {
      name: 'MC HAE.OBERKEULE',
      nameZh: '鸡大腿',
      qty: '2.871',
      unit: 'KG',
      unitPriceNet: '6.488',
      lineNet: '18.63',
      taxClass: 'B',
    },
    {
      name: '10er Eier',
      nameZh: '鸡蛋',
      qty: '2',
      unit: 'PG',
      unitPriceNet: '2.79',
      lineNet: '5.58',
      taxClass: 'B',
    },
  ],
  totals: { net: '26.20', vatA: '0.38', vatB: '1.69', gross: '28.27' },
};

const stubParser = (receipt: ParsedReceipt = RECEIPT): ReceiptParser => ({
  parseReceipt: async () => receipt,
});

/** 记录 provider 收到的输入,验证 route 原样透传(含 PDF mimeType) */
const recordingParser = (): {
  parser: ReceiptParser;
  last: () => { fileBase64: string; mimeType: string } | undefined;
} => {
  let seen: { fileBase64: string; mimeType: string } | undefined;
  return {
    parser: {
      parseReceipt: async (input) => {
        seen = input;
        return RECEIPT;
      },
    },
    last: () => seen,
  };
};

const failingParser: ReceiptParser = {
  parseReceipt: async () => {
    throw new Error('上游超时');
  },
};

const createBillReq = () =>
  new Request('http://x/bills', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...bearer },
    body: JSON.stringify({ title: 'Metro', taxCountry: 'DE' }),
  });

async function appWithBill(parser: ReceiptParser) {
  const app = testApp({ parser });
  const res = await app.request(createBillReq());
  const { id } = (await res.json()) as { id: string };
  return { app, id };
}

const parseReq = (
  id: string,
  body: { fileBase64: string; mimeType: string } = {
    fileBase64: 'aGk=',
    mimeType: 'image/jpeg',
  },
) =>
  new Request(`http://x/bills/${id}/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...bearer },
    body: JSON.stringify(body),
  });

describe('POST /bills/:id/parse', () => {
  it('识别结果转整数入库:条目 source=ai、行总额存 printedLineNetCents、合计入库', async () => {
    const { app, id } = await appWithBill(stubParser());
    const res = await app.request(parseReq(id));
    expect(res.status).toBe(200);
    const bill = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      printedTotals: unknown;
    };
    expect(bill.items).toHaveLength(3);
    expect(bill.items[1]).toMatchObject({
      name: 'MC HAE.OBERKEULE',
      nameZh: '鸡大腿',
      qtyMilli: 2871,
      unit: 'KG',
      unitPriceMilli: 6488,
      printedLineNetCents: 1863,
      taxClass: 'B',
      source: 'ai',
    });
    expect(bill.printedTotals).toEqual({
      netCents: 2620,
      vatByClass: { A: 38, B: 169 },
      grossCents: 2827,
    });
  });

  it('识别后 validate 用印刷行总额 0 差额对账', async () => {
    const { app, id } = await appWithBill(stubParser());
    await app.request(parseReq(id));
    const res = await app.request(
      new Request(`http://x/bills/${id}/validate`, { headers: bearer }),
    );
    const result = (await res.json()) as { ok: boolean };
    expect(result.ok).toBe(true);
  });

  it('重复识别覆盖 ai 条目,保留手动条目', async () => {
    const { app, id } = await appWithBill(stubParser());
    await app.request(
      new Request(`http://x/bills/${id}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...bearer },
        body: JSON.stringify({
          name: '手输行',
          qtyMilli: 1000,
          unitPriceMilli: 100,
          taxClass: 'A',
        }),
      }),
    );
    await app.request(parseReq(id));
    await app.request(parseReq(id));
    const bill = (await (
      await app.request(
        new Request(`http://x/bills/${id}`, { headers: bearer }),
      )
    ).json()) as {
      items: Array<{ source: string }>;
    };
    expect(bill.items.filter((i) => i.source === 'ai')).toHaveLength(3);
    expect(bill.items.filter((i) => i.source === 'manual')).toHaveLength(1);
  });

  it('存储已配置:识别时上传原图,invoiceUrl 记 Cloudinary URL', async () => {
    const app = testApp({
      parser: stubParser(),
      fileStore: { save: async () => 'https://res.cloudinary.com/x/inv.pdf' },
    });
    const { id } = (await (await app.request(createBillReq())).json()) as {
      id: string;
    };
    const bill = (await (await app.request(parseReq(id))).json()) as {
      invoiceUrl: string | null;
    };
    expect(bill.invoiceUrl).toBe('https://res.cloudinary.com/x/inv.pdf');
  });

  it('存储未配置(null store):正常识别,invoiceUrl 保持 null', async () => {
    const { app, id } = await appWithBill(stubParser());
    const bill = (await (await app.request(parseReq(id))).json()) as {
      invoiceUrl: string | null;
      items: unknown[];
    };
    expect(bill.invoiceUrl).toBeNull();
    expect(bill.items).toHaveLength(3);
  });

  it('存储抛错不阻断识别:invoiceUrl 为 null,条目照常入库', async () => {
    const app = testApp({
      parser: stubParser(),
      fileStore: {
        save: async () => {
          throw new Error('Cloudinary 挂了');
        },
      },
    });
    const { id } = (await (await app.request(createBillReq())).json()) as {
      id: string;
    };
    const res = await app.request(parseReq(id));
    expect(res.status).toBe(200);
    const bill = (await res.json()) as {
      invoiceUrl: string | null;
      items: unknown[];
    };
    expect(bill.invoiceUrl).toBeNull();
    expect(bill.items).toHaveLength(3);
  });

  it('PDF 上传:mimeType 与内容原样透传给 provider(PRD A1 支持 PDF)', async () => {
    const { parser, last } = recordingParser();
    const app = testApp({ parser });
    const { id } = (await (await app.request(createBillReq())).json()) as {
      id: string;
    };
    const res = await app.request(
      parseReq(id, { fileBase64: 'JVBERi0x', mimeType: 'application/pdf' }),
    );
    expect(res.status).toBe(200);
    expect(last()).toEqual({
      fileBase64: 'JVBERi0x',
      mimeType: 'application/pdf',
    });
  });

  it('缺 fileBase64 → 400;不支持的 mimeType → 400;provider 抛错 → 502;未知账单 → 404', async () => {
    const { app, id } = await appWithBill(stubParser());
    const bad = await app.request(
      new Request(`http://x/bills/${id}/parse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...bearer },
        body: JSON.stringify({}),
      }),
    );
    expect(bad.status).toBe(400);
    const badMime = await app.request(
      parseReq(id, { fileBase64: 'aGk=', mimeType: 'text/plain' }),
    );
    expect(badMime.status).toBe(400);
    expect((await app.request(parseReq('nope'))).status).toBe(404);

    const { app: app2, id: id2 } = await appWithBill(failingParser);
    expect((await app2.request(parseReq(id2))).status).toBe(502);
  });
});
