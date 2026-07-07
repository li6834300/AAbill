import { describe, expect, it } from 'vitest';
import {
  BillCreateSchema,
  ItemInputSchema,
  ParsedReceiptSchema,
  PrintedTotalsSchema,
} from '../src/index.js';

// 前后端共享的 API 边界 schema(PRD §5.2):
// - 金额过网络一律整数分 / 千分位整数(与 core 的表示一致)
// - AI 识别输出(ParsedReceipt)保持发票原貌:十进制字符串,由 server 边界转换

describe('BillCreateSchema', () => {
  it('接受标题 + 税制国家', () => {
    expect(BillCreateSchema.parse({ title: 'Metro 2026-05-16', taxCountry: 'DE' })).toEqual({
      title: 'Metro 2026-05-16',
      taxCountry: 'DE',
    });
  });

  it('拒绝空标题与未知国家', () => {
    expect(BillCreateSchema.safeParse({ title: '', taxCountry: 'DE' }).success).toBe(false);
    expect(BillCreateSchema.safeParse({ title: 'x', taxCountry: 'FR' }).success).toBe(false);
  });
});

describe('ItemInputSchema', () => {
  it('接受完整条目,默认值补齐', () => {
    const parsed = ItemInputSchema.parse({
      name: '10l ARO RAPSOEL',
      qtyMilli: 1000,
      unitPriceMilli: 12490,
      taxClass: 'B',
    });
    expect(parsed).toEqual({
      name: '10l ARO RAPSOEL',
      nameZh: '',
      qtyMilli: 1000,
      unit: 'ST',
      unitPriceMilli: 12490,
      taxClass: 'B',
      isShared: false,
    });
  });

  it('拒绝非整数/非正数量与非整数单价', () => {
    const base = { name: 'x', qtyMilli: 1000, unitPriceMilli: 100, taxClass: 'A' };
    expect(ItemInputSchema.safeParse({ ...base, qtyMilli: 0 }).success).toBe(false);
    expect(ItemInputSchema.safeParse({ ...base, qtyMilli: 10.5 }).success).toBe(false);
    expect(ItemInputSchema.safeParse({ ...base, unitPriceMilli: 1.5 }).success).toBe(false);
  });

  it('可选 printedLineNetCents 须为整数', () => {
    const base = { name: 'x', qtyMilli: 1000, unitPriceMilli: 100, taxClass: 'A' };
    expect(ItemInputSchema.parse({ ...base, printedLineNetCents: 2296 }).printedLineNetCents).toBe(
      2296,
    );
    expect(ItemInputSchema.safeParse({ ...base, printedLineNetCents: 22.96 }).success).toBe(false);
  });
});

describe('PrintedTotalsSchema', () => {
  it('整数分 + 分税类', () => {
    const totals = {
      netCents: 51721,
      vatByClass: { A: 59, B: 3599 },
      grossCents: 55379,
    };
    expect(PrintedTotalsSchema.parse(totals)).toEqual(totals);
    expect(PrintedTotalsSchema.safeParse({ ...totals, netCents: 517.21 }).success).toBe(false);
  });
});

describe('ParsedReceiptSchema(AI 识别输出,十进制字符串)', () => {
  const receipt = {
    items: [
      {
        name: 'MC HAE.OBERKEULE',
        nameZh: '鸡大腿',
        qty: '2.871',
        unit: 'KG',
        unitPriceNet: '6.488',
        lineNet: '18.63',
        taxClass: 'B',
      },
    ],
    totals: { net: '517.21', vatA: '0.59', vatB: '35.99', gross: '553.79' },
  };

  it('接受发票原貌的十进制字符串', () => {
    expect(ParsedReceiptSchema.parse(receipt)).toEqual(receipt);
  });

  it('拒绝超精度数量(>3 位小数)与非法金额(>2 位小数)', () => {
    const bad1 = structuredClone(receipt);
    bad1.items[0]!.qty = '2.8711';
    expect(ParsedReceiptSchema.safeParse(bad1).success).toBe(false);
    const bad2 = structuredClone(receipt);
    bad2.items[0]!.lineNet = '18.633';
    expect(ParsedReceiptSchema.safeParse(bad2).success).toBe(false);
  });
});
