import { describe, expect, it } from '@jest/globals';
import { hasClaimChanges } from '../claim-draft';

const items = [
  { id: 'mine', isShared: false, myPortion: 2 },
  { id: 'none', isShared: false, myPortion: 0 },
  { id: 'shared', isShared: true, myPortion: 0 },
];

describe('hasClaimChanges', () => {
  it('已提交数量与草稿一致时没有修改', () => {
    expect(hasClaimChanges(items, { mine: 2 })).toBe(false);
  });

  it('增加、减少或清空认领都算修改', () => {
    expect(hasClaimChanges(items, { mine: 3 })).toBe(true);
    expect(hasClaimChanges(items, { mine: 1 })).toBe(true);
    expect(hasClaimChanges(items, {})).toBe(true);
  });

  it('均摊商品不参与认领草稿比较', () => {
    expect(hasClaimChanges(items, { mine: 2, shared: 1 })).toBe(false);
  });
});
