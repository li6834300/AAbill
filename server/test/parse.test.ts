import type { ParsedReceipt } from '@aabill/api-types';
import { describe, expect, it } from 'vitest';
import type { ReceiptParser } from '../src/ai/provider.js';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';

// PRD A1/§5.4:POST /bills/:id/parse → provider 识别 → 条目写入(source=ai)+ 印刷合计入库。
// AI 输出是十进制字符串,server 边界转成整数分/千分位;印刷行总额(Wert)存 printedLineNetCents,
// 使 validate 可 0 差额对账(ADR 0003)。

const RECEIPT: ParsedReceipt = {
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

const failingParser: ReceiptParser = {
  parseReceipt: async () => {
    throw new Error('上游超时');
  },
};

async function appWithBill(parser: ReceiptParser) {
  const app = createApp({ repo: createInMemoryRepo(), parser });
  const res = await app.request(
    new Request('http://x/bills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Metro', taxCountry: 'DE' }),
    }),
  );
  const { id } = (await res.json()) as { id: string };
  return { app, id };
}

const parseReq = (id: string) =>
  new Request(`http://x/bills/${id}/parse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64: 'aGk=', mimeType: 'image/jpeg' }),
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
    const res = await app.request(`http://x/bills/${id}/validate`);
    const result = (await res.json()) as { ok: boolean };
    expect(result.ok).toBe(true);
  });

  it('重复识别覆盖 ai 条目,保留手动条目', async () => {
    const { app, id } = await appWithBill(stubParser());
    await app.request(
      new Request(`http://x/bills/${id}/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
    const bill = (await (await app.request(`http://x/bills/${id}`)).json()) as {
      items: Array<{ source: string }>;
    };
    expect(bill.items.filter((i) => i.source === 'ai')).toHaveLength(3);
    expect(bill.items.filter((i) => i.source === 'manual')).toHaveLength(1);
  });

  it('缺 imageBase64 → 400;provider 抛错 → 502;未知账单 → 404', async () => {
    const { app, id } = await appWithBill(stubParser());
    const bad = await app.request(
      new Request(`http://x/bills/${id}/parse`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(bad.status).toBe(400);
    expect((await app.request(parseReq('nope'))).status).toBe(404);

    const { app: app2, id: id2 } = await appWithBill(failingParser);
    expect((await app2.request(parseReq(id2))).status).toBe(502);
  });
});
