import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ClaimItemRow } from '../ClaimItemRow';

// 认领行(重设计):portion = 实际件数。
// 必须让用户看见:单价、共几件、别家已领几件、我还能领几件、我领了多少钱。
// 选择是**本地的**(不即时提交),由页面统一提交。

const eggs = {
  id: 'i-eggs',
  name: '10er Eier',
  nameZh: '鸡蛋',
  qtyMilli: 10000, // 10 盒
  unit: 'PG',
  unitPriceMilli: 2790, // 2.79 €/盒
  taxClass: 'B' as const,
  isShared: false,
  source: 'ai' as const,
};
const beef = {
  ...eggs,
  id: 'i-beef',
  name: 'RINDER FILET',
  nameZh: '牛柳',
  qtyMilli: 2871, // 2.871kg 一整块
  unit: 'KG',
  unitPriceMilli: 12290,
};

const base = {
  item: eggs,
  myPortion: 0,
  othersPortions: 0,
  locked: false,
  onChange: jest.fn(),
};

describe('ClaimItemRow(件数版)', () => {
  it('展示单价与总件数', () => {
    render(<ClaimItemRow {...base} />);
    expect(screen.getByText('10er Eier')).toBeTruthy();
    expect(screen.getByText(/2\.79/)).toBeTruthy(); // 单价
    expect(screen.getByText(/共 10 件/)).toBeTruthy();
  });

  it('别家已领时显示剩余可领件数', () => {
    render(<ClaimItemRow {...base} othersPortions={3} />);
    expect(screen.getByText(/别家已领 3/)).toBeTruthy();
    expect(screen.getByText(/还剩 7/)).toBeTruthy();
  });

  it('加减改变件数,并回传新件数', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} myPortion={2} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('inc-i-eggs'));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.press(screen.getByTestId('dec-i-eggs'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('不能超过剩余可领件数(别家领3 → 我最多7)', () => {
    const onChange = jest.fn();
    render(
      <ClaimItemRow
        {...base}
        myPortion={7}
        othersPortions={3}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByTestId('inc-i-eggs'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('件数为 0 时不能再减', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} myPortion={0} onChange={onChange} />);
    fireEvent.press(screen.getByTestId('dec-i-eggs'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('显示我这件领了多少钱(件数 × 单价)', () => {
    render(<ClaimItemRow {...base} myPortion={3} />);
    expect(screen.getByText(/8\.37/)).toBeTruthy(); // 3 × 2.79
  });

  it('计重商品:只能 0 或 1 件,显示重量', () => {
    const onChange = jest.fn();
    render(
      <ClaimItemRow {...base} item={beef} myPortion={1} onChange={onChange} />,
    );
    expect(screen.getByText(/2\.871 KG/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('inc-i-beef'));
    expect(onChange).not.toHaveBeenCalled(); // 整件,已领 1 就是上限
  });

  it('均摊商品:显示均摊,无加减控件', () => {
    render(<ClaimItemRow {...base} item={{ ...eggs, isShared: true }} />);
    expect(screen.getByText(/均摊/)).toBeTruthy();
    expect(screen.queryByTestId('inc-i-eggs')).toBeNull();
  });

  it('锁定后无加减控件', () => {
    render(<ClaimItemRow {...base} myPortion={2} locked />);
    expect(screen.queryByTestId('inc-i-eggs')).toBeNull();
    expect(screen.queryByTestId('dec-i-eggs')).toBeNull();
  });

  it('冲突时高亮并说明原因', () => {
    render(<ClaimItemRow {...base} myPortion={8} conflict="只剩 7 件可认领" />);
    expect(screen.getByText(/只剩 7 件可认领/)).toBeTruthy();
  });
});

// 件数多时逐个点 + 太累:允许直接填数字,点确认一次到位(带校验)
describe('ClaimItemRow 手动输入件数', () => {
  const typeAndConfirm = (value: string) => {
    fireEvent.changeText(screen.getByTestId('qty-input-i-eggs'), value);
    fireEvent.press(screen.getByTestId('qty-confirm-i-eggs'));
  };

  it('输入合法件数 → 确认后回传', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} onChange={onChange} />);
    typeAndConfirm('6');
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('超过可领件数(共10件填11)→ 报错且不回传', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} onChange={onChange} />);
    typeAndConfirm('11');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/最多.*10/)).toBeTruthy();
  });

  it('别家已领 3 时,最多只能填 7', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} othersPortions={3} onChange={onChange} />);
    typeAndConfirm('8');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/最多.*7/)).toBeTruthy();
  });

  it('非数字/负数 → 报错不回传', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} onChange={onChange} />);
    typeAndConfirm('abc');
    expect(onChange).not.toHaveBeenCalled();
    typeAndConfirm('-2');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/请输入/)).toBeTruthy();
  });

  it('填 0 = 取消认领,允许', () => {
    const onChange = jest.fn();
    render(<ClaimItemRow {...base} myPortion={5} onChange={onChange} />);
    typeAndConfirm('0');
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
