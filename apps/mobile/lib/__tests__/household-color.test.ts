import { describe, expect, it } from '@jest/globals';
import { householdColorAt } from '../household-color';
import { color, householdColor } from '../../theme/tokens';

// 家庭身份色:多家同时认领时一眼看出谁拿了什么。
// 关键约束:必须按索引稳定(同一家在 owner 端和 participant 端拿到同一个颜色),
// 且永远不撞语义色(主色绿 / 琥珀 / 陶土红)—— 撞了语义色就废了。

describe('householdColorAt', () => {
  it('按索引返回身份色', () => {
    expect(householdColorAt(0)).toBe(householdColor[0]);
    expect(householdColorAt(3)).toBe(householdColor[3]);
  });

  it('索引稳定 —— 同一索引永远同一颜色', () => {
    expect(householdColorAt(2)).toBe(householdColorAt(2));
  });

  it('超过色板长度时循环取用', () => {
    expect(householdColorAt(6)).toBe(householdColor[0]);
    expect(householdColorAt(7)).toBe(householdColor[1]);
    expect(householdColorAt(13)).toBe(householdColor[1]);
  });

  it('负索引也稳妥回到色板内(不返回 undefined)', () => {
    expect(householdColor).toContain(householdColorAt(-1));
  });

  it('永不返回语义色(绿/琥珀/红)', () => {
    const semantic: string[] = [color.primary, color.accent, color.danger];
    for (let i = 0; i < 20; i++) {
      expect(semantic).not.toContain(householdColorAt(i));
    }
  });
});
