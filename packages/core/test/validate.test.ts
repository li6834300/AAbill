import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/metro-de-2026-05-16.json';
import { DEFAULT_TAX_RATES, toMilli, validate, type BillItem } from '../src/index.js';

// 规格(PRD A4 / §4.6):validate() 把「按行取整重算的合计」与「发票印刷合计」对账,
// 返回精确差额(计算值 − 印刷值),由上层决定是否高亮引导人工排查。
// - 行净额默认 = lineNetCents(qty × 单价);OCR 读到印刷行总额时用 printedLineNetCents 覆盖
// - ok = 所有差额为 0

const A = (over?: Partial<BillItem>): BillItem => ({
  qtyMilli: 1000,
  unitPriceMilli: 1990, // 1.99 net
  taxClass: 'A',
  ...over,
});
const B = (over?: Partial<BillItem>): BillItem => ({
  qtyMilli: 2000,
  unitPriceMilli: 2790, // 2 × 2.79 = 5.58 net
  taxClass: 'B',
  ...over,
});

describe('validate', () => {
  it('合计一致:ok=true,差额全 0(DE 税率)', () => {
    // net A=199, B=558;vatA=round(199×.19)=38, vatB=round(558×.07)=39;gross=834
    const result = validate({
      items: [A(), B()],
      rates: DEFAULT_TAX_RATES.DE,
      printed: { netCents: 757, vatByClass: { A: 38, B: 39 }, grossCents: 834 },
    });
    expect(result.ok).toBe(true);
    expect(result.diffs).toEqual({ netCents: 0, vatByClass: { A: 0, B: 0 }, grossCents: 0 });
    expect(result.computed).toEqual({
      netByClass: { A: 199, B: 558 },
      netCents: 757,
      vatByClass: { A: 38, B: 39 },
      grossCents: 834,
    });
  });

  it('漏识别一行:差额为负并逐项上报,ok=false', () => {
    const result = validate({
      items: [A()],
      rates: DEFAULT_TAX_RATES.DE,
      printed: { netCents: 757, vatByClass: { A: 38, B: 39 }, grossCents: 834 },
    });
    expect(result.ok).toBe(false);
    expect(result.diffs).toEqual({
      netCents: -558,
      vatByClass: { A: 0, B: -39 },
      grossCents: -597,
    });
  });

  it('printedLineNetCents 覆盖 qty×单价 的推算值', () => {
    // 4.6 × 4.99 = 22.954 → 推算 2295;发票印刷行总额 22.96 → 以印刷为准
    const item = B({
      qtyMilli: toMilli('4.6'),
      unitPriceMilli: toMilli('4.99'),
      printedLineNetCents: 2296,
    });
    const result = validate({
      items: [item],
      rates: DEFAULT_TAX_RATES.DE,
      printed: { netCents: 2296, vatByClass: { A: 0, B: 161 }, grossCents: 2457 },
    });
    expect(result.ok).toBe(true);
  });

  it('NL 税率(21%/9%)由配置驱动', () => {
    const result = validate({
      items: [A(), B()],
      rates: DEFAULT_TAX_RATES.NL,
      // vatA=round(199×.21)=42, vatB=round(558×.09)=50 → gross 849
      printed: { netCents: 757, vatByClass: { A: 42, B: 50 }, grossCents: 849 },
    });
    expect(result.ok).toBe(true);
  });

  it('集成:Metro 发票 —— 两税额吻合,净额/含税差 -1 分(单价反推的转录伪差)', () => {
    const items: BillItem[] = fixture.items.map((it) => ({
      qtyMilli: toMilli(String(it.qty)),
      unitPriceMilli: toMilli(it.unit_price_net),
      taxClass: it.tax_class as 'A' | 'B',
    }));
    const p = fixture.invoice_totals_printed;
    const toCents = (s: string) => toMilli(s) / 10;
    const result = validate({
      items,
      rates: DEFAULT_TAX_RATES.DE,
      printed: {
        netCents: toCents(p.net), // 51721
        vatByClass: { A: toCents(p.vat_a), B: toCents(p.vat_b) }, // 59 / 3599
        grossCents: toCents(p.gross), // 55379
      },
    });
    // fixture notes:三位小数单价由印刷行总额反推,±0.5 分/行的损耗汇总为 -1 分。
    // validate() 的职责是如实报出差额(PRD A4:引导人工排查),而非强行归零。
    expect(result.diffs).toEqual({
      netCents: -1,
      vatByClass: { A: 0, B: 0 },
      grossCents: -1,
    });
    expect(result.ok).toBe(false);
    expect(result.computed.grossCents).toBe(55378);
  });
});
