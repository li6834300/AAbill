import { describe, expect, it } from '@jest/globals';
import { vatCents } from '@aabill/core';
import { claimTotals } from '../claim-total';
import type { ItemView } from '../../components/ItemRow';

// 底栏实时汇总的算钱逻辑。抽自 b/[token] 屏幕内联计算,便于测试。
// 计件:件数 × 单价;计重:整块 = 重量 × 单价(只能 0/1);税按税类加。

const eggs: ItemView = {
  id: 'eggs',
  name: '10er Eier',
  nameTranslated: '鸡蛋',
  qtyMilli: 10000, // 10 件
  unit: 'PG',
  unitPriceMilli: 2790, // 2.79 €/件
  taxClass: 'B',
  isShared: false,
  source: 'ai',
};
const beef: ItemView = {
  id: 'beef',
  name: 'RINDER FILET',
  nameTranslated: '牛柳',
  qtyMilli: 2871, // 2.871 kg 一整块
  unit: 'KG',
  unitPriceMilli: 12290, // 12.29 €/kg
  taxClass: 'A',
  isShared: false,
  source: 'ai',
};
const sharedMilk: ItemView = {
  ...eggs,
  id: 'milk',
  isShared: true,
};

const rates = { A: 1900, B: 700 };

describe('claimTotals', () => {
  it('空草稿 → 全 0', () => {
    expect(claimTotals([eggs, beef], {}, rates)).toEqual({
      netCents: 0,
      grossCents: 0,
      kinds: 0,
      units: 0,
    });
  });

  it('计件:3 个鸡蛋 = 3 × 2.79 净额,含 B 税', () => {
    const r = claimTotals([eggs], { eggs: 3 }, rates);
    expect(r.netCents).toBe(837);
    expect(r.grossCents).toBe(837 + vatCents(837, rates.B));
    expect(r.kinds).toBe(1);
    expect(r.units).toBe(3);
  });

  it('计重:整块牛柳 = 重量 × 单价(round 到分)', () => {
    // 2871 × 12290 / 10000 = 3528.459 → 3528 分
    const r = claimTotals([beef], { beef: 1 }, rates);
    expect(r.netCents).toBe(3528);
    expect(r.grossCents).toBe(3528 + vatCents(3528, rates.A));
    expect(r.units).toBe(1);
  });

  it('均摊商品被排除', () => {
    const r = claimTotals([eggs, sharedMilk], { eggs: 2, milk: 5 }, rates);
    expect(r.kinds).toBe(1); // 只算 eggs
    expect(r.netCents).toBe(558); // 2 × 2.79
  });

  it('税制未定(rates null)→ 含税额 = 净额', () => {
    const r = claimTotals([eggs], { eggs: 2 }, null);
    expect(r.netCents).toBe(558);
    expect(r.grossCents).toBe(558);
  });

  it('多种商品累加,kinds/units 正确', () => {
    const r = claimTotals([eggs, beef], { eggs: 3, beef: 1 }, rates);
    expect(r.kinds).toBe(2);
    expect(r.units).toBe(4);
    expect(r.netCents).toBe(837 + 3528);
  });
});
