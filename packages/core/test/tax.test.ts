import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/metro-de-2026-05-16.json';
import {
  bpFromPercent,
  DEFAULT_TAX_RATES,
  lineNetCents,
  toMilli,
  vatCents,
} from '../src/index.js';

// 金额表示规格:
// - 金额一律整数分(cent)
// - 数量与单价用整数千分位(qty 2.871kg → 2871;单价 6.488€ → 6488,覆盖 Metro 0.1 分精度)
// - 取整 = 四舍五入、远离零(负数对称,对应德国 kaufmännische Rundung)

describe('toMilli:十进制字符串 → 整数千分位', () => {
  it('解析整数与 1~3 位小数', () => {
    expect(toMilli('2')).toBe(2000);
    expect(toMilli('0.1')).toBe(100);
    expect(toMilli('1.99')).toBe(1990);
    expect(toMilli('6.488')).toBe(6488);
  });

  it('解析负数(折扣行)', () => {
    expect(toMilli('-1.99')).toBe(-1990);
  });

  it('拒绝超过 3 位小数与非法输入', () => {
    expect(() => toMilli('1.2345')).toThrow();
    expect(() => toMilli('abc')).toThrow();
    expect(() => toMilli('')).toThrow();
  });
});

describe('lineNetCents:行净额 = qty × 折后净单价,四舍五入到分', () => {
  it('整数数量 × 两位小数单价:精确无取整', () => {
    expect(lineNetCents(toMilli('1'), toMilli('1.99'))).toBe(199);
    expect(lineNetCents(toMilli('2'), toMilli('2.79'))).toBe(558);
  });

  it('KG 计重 × 0.1 分精度单价:向上取整分支', () => {
    // 2.871 × 6.488 = 18.627048 → 18.63
    expect(lineNetCents(toMilli('2.871'), toMilli('6.488'))).toBe(1863);
  });

  it('KG 计重:向下取整分支', () => {
    // 4.600 × 4.99 = 22.954 → 22.95
    expect(lineNetCents(toMilli('4.600'), toMilli('4.99'))).toBe(2295);
  });

  it('恰好半分:进位', () => {
    // 0.500 × 0.01 = 0.005 → 0.01
    expect(lineNetCents(toMilli('0.5'), toMilli('0.01'))).toBe(1);
  });

  it('负单价(折扣行):对称取整、远离零', () => {
    expect(lineNetCents(toMilli('1'), toMilli('-1.99'))).toBe(-199);
    expect(lineNetCents(toMilli('0.5'), toMilli('-0.01'))).toBe(-1);
  });

  it('数量为零:净额为零', () => {
    expect(lineNetCents(0, toMilli('9.99'))).toBe(0);
  });
});

describe('vatCents:税额 = 净额 × 基点税率,四舍五入到分', () => {
  it('常规取整', () => {
    expect(vatCents(308, 1900)).toBe(59); // 0.5852 → 0.59
    expect(vatCents(51412, 700)).toBe(3599); // 35.9884 → 35.99
  });

  it('非整数百分比全程整数运算', () => {
    // 法国 5.5%:100.00 € 净额 → 5.50 €
    expect(vatCents(10000, 550)).toBe(550);
    // 瑞士 8.1%:19.99 € → 1.61919 → 1.62
    expect(vatCents(1999, 810)).toBe(162);
  });

  it('恰好半分:进位;负净额对称', () => {
    expect(vatCents(50, 100)).toBe(1); // 0.005 → 0.01
    expect(vatCents(-50, 100)).toBe(-1);
  });

  it('零税率与零净额', () => {
    expect(vatCents(1000, 0)).toBe(0);
    expect(vatCents(0, 1900)).toBe(0);
  });
});

describe('税率用基点(bp)表示,不用整数百分比', () => {
  // 法国 5.5%、瑞士 8.1%、芬兰 25.5% 都不是整数 —— 整数百分比装不下,
  // 浮点百分比又会把误差带进分账取整。故一律整数基点:19% = 1900bp。
  it('DE:A 1900 / B 700;NL:A 2100 / B 900', () => {
    expect(DEFAULT_TAX_RATES.DE).toEqual({ A: 1900, B: 700 });
    expect(DEFAULT_TAX_RATES.NL).toEqual({ A: 2100, B: 900 });
  });

  it('覆盖非整数税率的国家', () => {
    expect(DEFAULT_TAX_RATES.FR.B).toBe(550); // 5.5%
    expect(DEFAULT_TAX_RATES.CH).toEqual({ A: 810, B: 260 }); // 8.1% / 2.6%
    expect(DEFAULT_TAX_RATES.IE.B).toBe(1350); // 13.5%
  });

  it('丹麦没有低税率档:两档相同', () => {
    expect(DEFAULT_TAX_RATES.DK).toEqual({ A: 2500, B: 2500 });
  });

  it('每个国家的低税率都不高于标准税率,且都在合理区间', () => {
    for (const [country, r] of Object.entries(DEFAULT_TAX_RATES)) {
      expect(r.B, country).toBeLessThanOrEqual(r.A);
      expect(r.A, country).toBeGreaterThan(0);
      expect(r.A, country).toBeLessThanOrEqual(2800);
      expect(Number.isInteger(r.A), country).toBe(true);
      expect(Number.isInteger(r.B), country).toBe(true);
    }
  });
});

describe('bpFromPercent:发票印刷的百分比 → 基点', () => {
  // 发票上的实际税率才是权威 —— 国家表只是读不出时的兜底。
  it('整数与小数百分比', () => {
    expect(bpFromPercent('19')).toBe(1900);
    expect(bpFromPercent('5.5')).toBe(550);
    expect(bpFromPercent('8.10')).toBe(810);
  });

  it('欧洲发票用逗号做小数点', () => {
    expect(bpFromPercent('19,00')).toBe(1900);
    expect(bpFromPercent('25,5')).toBe(2550);
  });

  it('带百分号与空白', () => {
    expect(bpFromPercent(' 7,0 % ')).toBe(700);
  });

  it('零税率(英国/爱尔兰食品)是合法值', () => {
    expect(bpFromPercent('0')).toBe(0);
    expect(bpFromPercent('0,00')).toBe(0);
  });

  it('读不出来就抛错,不猜', () => {
    expect(() => bpFromPercent('')).toThrow();
    expect(() => bpFromPercent('abc')).toThrow();
    expect(() => bpFromPercent('19.005')).toThrow(); // 超过 2 位小数
    expect(() => bpFromPercent('-19')).toThrow();
    expect(() => bpFromPercent('120')).toThrow(); // 不存在的税率
  });
});

describe('集成:Metro 真实发票 42 行', () => {
  it('按行取整后的分类净额、税额与推导含税额', () => {
    const rates = DEFAULT_TAX_RATES.DE;
    const netByClass = { A: 0, B: 0 };
    for (const item of fixture.items) {
      const cents = lineNetCents(
        toMilli(String(item.qty)),
        toMilli(item.unit_price_net),
      );
      netByClass[item.tax_class as 'A' | 'B'] += cents;
    }
    // 发票印刷值:net 517.21 / vat_a 0.59 / vat_b 35.99 / gross 553.79。
    // fixture 的三位小数单价是从印刷行总额反推的(±0.5 分损耗),
    // 行级取整重算后净额比印刷值低 1 分——这是转录伪差,由 validate() 作为差额如实上报。
    expect(netByClass.A).toBe(308); // 印刷一致
    expect(netByClass.B).toBe(51412); // 印刷值 51413,转录伪差 -1
    expect(vatCents(netByClass.A, rates.A)).toBe(59); // 与印刷 vat_a 一致
    expect(vatCents(netByClass.B, rates.B)).toBe(3599); // 与印刷 vat_b 一致
    const gross =
      netByClass.A +
      netByClass.B +
      vatCents(netByClass.A, rates.A) +
      vatCents(netByClass.B, rates.B);
    expect(gross).toBe(55378); // 印刷值 55379,承接净额的 -1 分
  });
});
