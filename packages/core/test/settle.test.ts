import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/metro-de-2026-05-16.json';
import {
  DEFAULT_TAX_RATES,
  settle,
  toMilli,
  type SettleItem,
} from '../src/index.js';

// 规格(PRD D2 / §4.5 / §4.7):
// - 每个商品的净额按认领份数(或均摊=全家庭等份)用最大余数法拆给家庭
// - 分类税额在家庭间按其该类净额比例分摊(最大余数法)
// - 每家 gross = 净额 + 税额;Σ家庭 gross 必须精确等于账单计算 gross(尾差铁律)
// - 存在未认领商品时拒绝结算(PRD D1:全部认领完成才可锁定)

const RATES = DEFAULT_TAX_RATES.DE;

describe('settle:小案例(手算基准)', () => {
  const families = ['甲', '乙', '丙'];
  const items: SettleItem[] = [
    // 鸡蛋 2×2.79=5.58 均摊 → [186,186,186]
    { qtyMilli: 2000, unitPriceMilli: 2790, taxClass: 'B', isShared: true },
    // 铝箔 1.99(A)甲独占
    {
      qtyMilli: 1000,
      unitPriceMilli: 1990,
      taxClass: 'A',
      claims: [{ familyId: '甲', portion: 1 }],
    },
    // 奶酪条 3×2.05=6.15 甲1份/乙2份 → [205,410,0]
    {
      qtyMilli: 3000,
      unitPriceMilli: 2050,
      taxClass: 'B',
      claims: [
        { familyId: '甲', portion: 1 },
        { familyId: '乙', portion: 2 },
      ],
    },
  ];

  it('净额/税额/含税逐家正确,总和精确守恒', () => {
    const result = settle({ items, families, rates: RATES });
    // 甲: A199 + B(186+205)=391;vatA=38 全归甲;vatB=82 按 [391,596,186] 分 → [27,42,13]
    expect(result.families).toEqual([
      {
        familyId: '甲',
        netByClass: { A: 199, B: 391 },
        netCents: 590,
        vatByClass: { A: 38, B: 27 },
        vatCents: 65,
        grossCents: 655,
      },
      {
        familyId: '乙',
        netByClass: { A: 0, B: 596 },
        netCents: 596,
        vatByClass: { A: 0, B: 42 },
        vatCents: 42,
        grossCents: 638,
      },
      {
        familyId: '丙',
        netByClass: { A: 0, B: 186 },
        netCents: 186,
        vatByClass: { A: 0, B: 13 },
        vatCents: 13,
        grossCents: 199,
      },
    ]);
    expect(result.totals).toEqual({
      netByClass: { A: 199, B: 1173 },
      netCents: 1372,
      vatByClass: { A: 38, B: 82 },
      grossCents: 1492,
    });
    const grossSum = result.families.reduce((a, f) => a + f.grossCents, 0);
    expect(grossSum).toBe(result.totals.grossCents);
  });

  it('均摊尾差:1.00€ 三家分 → 34/33/33,和守恒', () => {
    const result = settle({
      items: [
        { qtyMilli: 1000, unitPriceMilli: 1000, taxClass: 'A', isShared: true },
      ],
      families,
      rates: { A: 0, B: 0 }, // 隔离税额,只看净额拆分
    });
    expect(result.families.map((f) => f.netCents)).toEqual([34, 33, 33]);
    expect(result.families.reduce((a, f) => a + f.grossCents, 0)).toBe(100);
  });
});

describe('settle:输入校验', () => {
  const families = ['甲', '乙'];
  const base = { qtyMilli: 1000, unitPriceMilli: 1000, taxClass: 'A' as const };

  it('未认领且未均摊的商品:拒绝结算并指明商品', () => {
    const items: SettleItem[] = [{ ...base, name: '品客薯片' }];
    expect(() => settle({ items, families, rates: RATES })).toThrow(/品客薯片/);
  });

  it('claims 为空数组视同未认领', () => {
    expect(() =>
      settle({ items: [{ ...base, claims: [] }], families, rates: RATES }),
    ).toThrow();
  });

  it('同时标记均摊与认领:语义冲突,拒绝', () => {
    const items: SettleItem[] = [
      { ...base, isShared: true, claims: [{ familyId: '甲', portion: 1 }] },
    ];
    expect(() => settle({ items, families, rates: RATES })).toThrow();
  });

  it('认领了不存在的家庭:拒绝', () => {
    const items: SettleItem[] = [
      { ...base, claims: [{ familyId: '路人', portion: 1 }] },
    ];
    expect(() => settle({ items, families, rates: RATES })).toThrow(/路人/);
  });

  it('份数必须为正整数', () => {
    for (const portion of [0, -1, 0.5]) {
      const items: SettleItem[] = [
        { ...base, claims: [{ familyId: '甲', portion }] },
      ];
      expect(() => settle({ items, families, rates: RATES })).toThrow();
    }
  });

  it('家庭列表为空:拒绝', () => {
    expect(() =>
      settle({
        items: [{ ...base, isShared: true }],
        families: [],
        rates: RATES,
      }),
    ).toThrow();
  });
});

describe('settle:Metro 发票集成(reference_family 作认领)', () => {
  it('每家净额/税额/含税与独立验算一致,Σgross 精确等于计算 gross', () => {
    const families = fixture.meta.families; // [Rio家, Yuxi家, 老唐家]
    const items: SettleItem[] = fixture.items.map((it) => ({
      name: it.name,
      qtyMilli: toMilli(String(it.qty)),
      unitPriceMilli: toMilli(it.unit_price_net),
      taxClass: it.tax_class as 'A' | 'B',
      claims: [{ familyId: it.reference_family, portion: 1 }],
    }));
    const result = settle({ items, families, rates: RATES });

    // 期望值经 scratchpad 独立验算(见 docs/tdd-log M1 篇);
    // reference_family 仅作对照来源,手工 Excel 的浮点汇总不作 golden。
    expect(result.families).toEqual([
      {
        familyId: 'Rio家',
        netByClass: { A: 0, B: 17355 },
        netCents: 17355,
        vatByClass: { A: 0, B: 1215 },
        vatCents: 1215,
        grossCents: 18570,
      },
      {
        familyId: 'Yuxi家',
        netByClass: { A: 0, B: 20390 },
        netCents: 20390,
        vatByClass: { A: 0, B: 1427 },
        vatCents: 1427,
        grossCents: 21817,
      },
      {
        familyId: '老唐家',
        netByClass: { A: 308, B: 13667 },
        netCents: 13975,
        vatByClass: { A: 59, B: 957 },
        vatCents: 1016,
        grossCents: 14991,
      },
    ]);
    expect(result.totals.grossCents).toBe(55378);
    expect(result.families.reduce((a, f) => a + f.grossCents, 0)).toBe(55378);
  });
});
