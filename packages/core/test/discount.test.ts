import { describe, expect, it } from 'vitest';
import { allocateDiscount } from '../src/index.js';

// 规格(PRD B4 / §4.4):整单折扣不单列一行,按各商品净额比例分摊,
// 分摊之和精确等于折扣额(尾差走最大余数法)。Metro 的 INT KD 价已含折扣,不适用本函数。

describe('allocateDiscount', () => {
  it('tdd-workflow 基准例:净额 10€/30€,折扣 4€ → 1€/3€', () => {
    expect(allocateDiscount(400, [1000, 3000])).toEqual([100, 300]);
  });

  it('除不尽:尾差按最大余数法,和精确等于折扣', () => {
    // 100 按 [333, 333, 334]:33.3/33.3/33.4 → [33, 33, 34]
    const parts = allocateDiscount(100, [333, 333, 334]);
    expect(parts).toEqual([33, 33, 34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('单商品独担全部折扣;折扣为 0 → 全 0', () => {
    expect(allocateDiscount(250, [999])).toEqual([250]);
    expect(allocateDiscount(0, [1000, 3000])).toEqual([0, 0]);
  });

  it('净额为 0 的商品不分摊折扣', () => {
    expect(allocateDiscount(100, [0, 500, 500])).toEqual([0, 50, 50]);
  });

  it('折扣超过商品净额之和:拒绝', () => {
    expect(() => allocateDiscount(4001, [1000, 3000])).toThrow();
  });

  it('负净额商品(折扣行)不允许作为分摊基数', () => {
    expect(() => allocateDiscount(100, [1000, -10])).toThrow();
  });
});
