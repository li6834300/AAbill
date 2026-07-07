import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/metro-de-2026-05-16.json';
import {
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

describe('vatCents:税额 = 净额 × 整数百分比税率,四舍五入到分', () => {
  it('常规取整', () => {
    expect(vatCents(308, 19)).toBe(59); // 0.5852 → 0.59
    expect(vatCents(51412, 7)).toBe(3599); // 35.9884 → 35.99
  });

  it('恰好半分:进位;负净额对称', () => {
    expect(vatCents(50, 1)).toBe(1); // 0.005 → 0.01
    expect(vatCents(-50, 1)).toBe(-1);
  });

  it('零税率与零净额', () => {
    expect(vatCents(1000, 0)).toBe(0);
    expect(vatCents(0, 19)).toBe(0);
  });
});

describe('税率配置(按账单国家,不硬编码进计算)', () => {
  it('DE:A 19% / B 7%;NL:A 21% / B 9%', () => {
    expect(DEFAULT_TAX_RATES.DE).toEqual({ A: 19, B: 7 });
    expect(DEFAULT_TAX_RATES.NL).toEqual({ A: 21, B: 9 });
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
