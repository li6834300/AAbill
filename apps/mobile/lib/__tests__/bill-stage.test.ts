import { describe, expect, it } from '@jest/globals';
import type { Bill } from '@aabill/api-types';
import { billStage, STAGES, type Stage } from '../bill-stage';

// Owner 端阶段机:由账单数据纯函数推导。无新增服务端状态。
// scan(空) → review(有条目但未对上合计) → share(对上但没家庭/没领完) → summary(领完) ;locked 覆盖一切。

const base: Bill = {
  id: 'b1',
  ownerId: 'o1',
  title: 'Metro',
  translationLang: 'zh',
  taxCountry: 'DE',
  taxRates: { A: 1900, B: 700 },
  status: 'draft',
  createdAt: '2026-08-03',
  shareToken: 'tok',
  invoiceUrl: null,
  printedTotals: null,
  items: [],
  families: [],
  claims: [],
};

const item = (id: string, isShared = false) => ({
  id,
  name: id,
  nameTranslated: '',
  qtyMilli: 1000,
  unit: 'ST',
  unitPriceMilli: 1000,
  taxClass: 'B' as const,
  isShared,
  source: 'ai' as const,
});
const totals = { netCents: 100, vatByClass: { A: 0, B: 7 }, grossCents: 107 };

describe('billStage', () => {
  it('空条目 → scan', () => {
    expect(billStage(base, true)).toBe('scan');
  });

  it('有条目但没填合计 → review', () => {
    expect(billStage({ ...base, items: [item('a')] }, true)).toBe('review');
  });

  it('有合计但校验没通过 → review', () => {
    expect(
      billStage({ ...base, items: [item('a')], printedTotals: totals }, false),
    ).toBe('review');
  });

  it('校验通过但没家庭 → share', () => {
    expect(
      billStage({ ...base, items: [item('a')], printedTotals: totals }, true),
    ).toBe('share');
  });

  it('有家庭但还没领完 → share', () => {
    const bill: Bill = {
      ...base,
      items: [item('a'), item('b')],
      printedTotals: totals,
      families: [{ id: 'f1', name: 'Rio', sortOrder: 0 }],
      claims: [
        {
          id: 'c1',
          itemId: 'a',
          familyId: 'f1',
          portion: 1,
          updatedAt: '2026-08-03',
        },
      ],
    };
    expect(billStage(bill, true)).toBe('share');
  });

  it('可认领项都领了 → summary(均摊项不要求认领)', () => {
    const bill: Bill = {
      ...base,
      items: [item('a'), item('shared', true)],
      printedTotals: totals,
      families: [{ id: 'f1', name: 'Rio', sortOrder: 0 }],
      claims: [
        {
          id: 'c1',
          itemId: 'a',
          familyId: 'f1',
          portion: 1,
          updatedAt: '2026-08-03',
        },
      ],
    };
    expect(billStage(bill, true)).toBe('summary');
  });

  it('locked 覆盖一切,连空账单也是 locked', () => {
    expect(billStage({ ...base, status: 'locked' }, true)).toBe('locked');
    expect(billStage({ ...base, status: 'locked', items: [] }, false)).toBe(
      'locked',
    );
  });

  it('STAGES 顺序稳定,可用于步骤条', () => {
    expect(STAGES).toEqual([
      'scan',
      'review',
      'share',
      'summary',
    ] satisfies Stage[]);
  });
});
