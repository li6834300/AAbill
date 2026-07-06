import { describe, expect, it } from 'vitest';
import { splitEvenly } from '../src/index.js';

// 规格(PRD B3 / §4.5):标记为「均摊」的商品由全部家庭平分,
// 除不尽的尾差按最大余数法(并列时排前的家庭先得),和精确守恒。

describe('splitEvenly', () => {
  it('整除:精确平分', () => {
    // 鸡蛋 2×2.79 = 5.58,3 家平分 → 每家 1.86
    expect(splitEvenly(558, 3)).toEqual([186, 186, 186]);
  });

  it('除不尽:尾差给排前的家庭,和精确守恒', () => {
    expect(splitEvenly(280, 3)).toEqual([94, 93, 93]);
    expect(splitEvenly(101, 2)).toEqual([51, 50]);
  });

  it('单个家庭独担;零金额全 0', () => {
    expect(splitEvenly(999, 1)).toEqual([999]);
    expect(splitEvenly(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('家庭数必须为正整数', () => {
    expect(() => splitEvenly(100, 0)).toThrow();
    expect(() => splitEvenly(100, -2)).toThrow();
    expect(() => splitEvenly(100, 1.5)).toThrow();
  });
});
