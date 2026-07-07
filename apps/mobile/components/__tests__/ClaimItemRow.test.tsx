import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ClaimItemRow } from '../ClaimItemRow';

// PRD C2:Participant 勾选自己买的商品;已被别家认领的有标识;
// 同一商品可多家共享(按份数);均摊商品不可认领;锁定后只读。

const item = {
  id: 'i1',
  name: '4X20g KERRY CHEESTRINGS',
  nameZh: '奶酪条',
  qtyMilli: 3000,
  unit: 'SP',
  unitPriceMilli: 2050,
  taxClass: 'B' as const,
  isShared: false,
  source: 'ai' as const,
};

const families = [
  { id: 'f1', name: 'Rio家', sortOrder: 0 },
  { id: 'f2', name: '老唐家', sortOrder: 1 },
];

const base = {
  item,
  families,
  claims: [] as Array<{ itemId: string; familyId: string; portion: number }>,
  selectedFamilyId: 'f1',
  locked: false,
  onSetPortion: jest.fn(),
};

describe('ClaimItemRow', () => {
  it('展示名称/中文名/行净额,他家认领显示标识', () => {
    render(
      <ClaimItemRow
        {...base}
        claims={[{ itemId: 'i1', familyId: 'f2', portion: 2 }]}
      />,
    );
    expect(screen.getByText('4X20g KERRY CHEESTRINGS')).toBeTruthy();
    expect(screen.getByText(/奶酪条/)).toBeTruthy();
    expect(screen.getByText(/6\.15/)).toBeTruthy(); // 3×2.05
    expect(screen.getByText(/老唐家 ×2/)).toBeTruthy();
  });

  it('未认领:点「认领」→ onSetPortion(1)', () => {
    const onSetPortion = jest.fn();
    render(<ClaimItemRow {...base} onSetPortion={onSetPortion} />);
    fireEvent.press(screen.getByText('认领'));
    expect(onSetPortion).toHaveBeenCalledWith(1);
  });

  it('已认领 2 份:＋→3,−→1,取消→0', () => {
    const onSetPortion = jest.fn();
    render(
      <ClaimItemRow
        {...base}
        claims={[{ itemId: 'i1', familyId: 'f1', portion: 2 }]}
        onSetPortion={onSetPortion}
      />,
    );
    fireEvent.press(screen.getByText('＋'));
    expect(onSetPortion).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByText('−'));
    expect(onSetPortion).toHaveBeenCalledWith(1);
    fireEvent.press(screen.getByText('取消'));
    expect(onSetPortion).toHaveBeenCalledWith(0);
  });

  it('均摊商品:显示「均摊」,无认领控件', () => {
    render(<ClaimItemRow {...base} item={{ ...item, isShared: true }} />);
    expect(screen.getByText(/均摊/)).toBeTruthy();
    expect(screen.queryByText('认领')).toBeNull();
  });

  it('锁定后:无任何操作按钮', () => {
    render(
      <ClaimItemRow
        {...base}
        locked
        claims={[{ itemId: 'i1', familyId: 'f1', portion: 1 }]}
      />,
    );
    expect(screen.queryByText('认领')).toBeNull();
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('＋')).toBeNull();
  });

  it('未选择家庭:提示先选家庭,无认领按钮', () => {
    render(<ClaimItemRow {...base} selectedFamilyId={null} />);
    expect(screen.queryByText('认领')).toBeNull();
  });
});
