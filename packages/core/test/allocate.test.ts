import { describe, expect, it } from 'vitest';
import { allocateByLargestRemainder } from '../src/index.js';

// 规格:把 totalCents 按权重比例拆分为整数分,尾差按最大余数法分配。
// - 结果之和必须精确等于 totalCents(尾差铁律)
// - 余数并列时按下标靠前者优先(确定性)
// - 负数总额镜像处理(整单折扣场景)

describe('allocateByLargestRemainder', () => {
  it('整除:精确按比例,无尾差', () => {
    expect(allocateByLargestRemainder(400, [1000, 3000])).toEqual([100, 300]);
    expect(allocateByLargestRemainder(100, [1, 1, 3])).toEqual([20, 20, 60]);
  });

  it('除不尽:尾差给最大余数者', () => {
    // 10/3 = 3.33...,余数并列 → 下标靠前者得尾差
    expect(allocateByLargestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocateByLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByLargestRemainder(101, [1, 1])).toEqual([51, 50]);
  });

  it('余数不同:大者先得', () => {
    // 100×2/7=28.57(余.57) 100×5/7=71.43(余.43) → [29, 71]
    expect(allocateByLargestRemainder(100, [2, 5])).toEqual([29, 71]);
  });

  it('零权重项分得 0', () => {
    expect(allocateByLargestRemainder(100, [0, 1, 1])).toEqual([0, 50, 50]);
    expect(allocateByLargestRemainder(101, [0, 1, 1])).toEqual([0, 51, 50]);
  });

  it('总额为 0 → 全 0;单个权重独得', () => {
    expect(allocateByLargestRemainder(0, [3, 7])).toEqual([0, 0]);
    expect(allocateByLargestRemainder(999, [42])).toEqual([999]);
  });

  it('负数总额(整单折扣):镜像分配,和精确守恒', () => {
    expect(allocateByLargestRemainder(-400, [1000, 3000])).toEqual([
      -100, -300,
    ]);
    expect(allocateByLargestRemainder(-101, [1, 1])).toEqual([-51, -50]);
  });

  it('和守恒:一组刁钻用例', () => {
    const cases: Array<[number, number[]]> = [
      [55378, [13975, 17355, 20390]],
      [1, [999, 1]],
      [7, [1, 1, 1]],
      [3599, [308, 51412, 7]],
    ];
    for (const [total, weights] of cases) {
      const parts = allocateByLargestRemainder(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts).toHaveLength(weights.length);
    }
  });

  it('非法输入:空权重、负权重、权重和为 0', () => {
    expect(() => allocateByLargestRemainder(100, [])).toThrow();
    expect(() => allocateByLargestRemainder(100, [1, -1])).toThrow();
    expect(() => allocateByLargestRemainder(100, [0, 0])).toThrow();
  });
});
