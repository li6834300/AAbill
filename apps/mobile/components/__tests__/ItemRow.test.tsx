import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ItemRow } from '../ItemRow';

// PRD A2/B3:条目行 —— 展示名称/中文名/数量×单价/行净额;可修正、可删、可标均摊。

const item = {
  id: 'i1',
  name: '10er Eier bunt M Boden',
  nameTranslated: '散养鸡蛋 10个',
  qtyMilli: 2000,
  unit: 'PG',
  unitPriceMilli: 2790,
  taxClass: 'B' as const,
  isShared: false,
  source: 'ai' as const,
};

describe('ItemRow', () => {
  it('展示名称、中文名与行净额(2×2.79=5.58)', () => {
    render(<ItemRow item={item} onPatch={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText('10er Eier bunt M Boden')).toBeTruthy();
    expect(screen.getByText(/散养鸡蛋 10个/)).toBeTruthy();
    expect(screen.getByText(/5\.58/)).toBeTruthy();
  });

  it('均摊开关触发 onPatch({isShared:true})', () => {
    const onPatch = jest.fn();
    render(<ItemRow item={item} onPatch={onPatch} onDelete={jest.fn()} />);
    fireEvent(screen.getByTestId('shared-switch'), 'valueChange', true);
    expect(onPatch).toHaveBeenCalledWith({ isShared: true });
  });

  it('编辑模式改中文名与单价,保存后合并为一次 onPatch', () => {
    const onPatch = jest.fn();
    render(<ItemRow item={item} onPatch={onPatch} onDelete={jest.fn()} />);
    fireEvent.press(screen.getByText('编辑'));
    fireEvent.changeText(
      screen.getByTestId('edit-nameTranslated'),
      '鸡蛋(散养)',
    );
    fireEvent.changeText(screen.getByTestId('edit-price'), '2.69');
    fireEvent.press(screen.getByText('保存'));
    expect(onPatch).toHaveBeenCalledWith({
      nameTranslated: '鸡蛋(散养)',
      unitPriceMilli: 2690,
    });
  });

  it('单价输入非法时保存不提交该字段', () => {
    const onPatch = jest.fn();
    render(<ItemRow item={item} onPatch={onPatch} onDelete={jest.fn()} />);
    fireEvent.press(screen.getByText('编辑'));
    fireEvent.changeText(screen.getByTestId('edit-price'), 'abc');
    fireEvent.press(screen.getByText('保存'));
    expect(onPatch).toHaveBeenCalledWith({});
  });

  it('删除按钮触发 onDelete', () => {
    const onDelete = jest.fn();
    render(<ItemRow item={item} onPatch={jest.fn()} onDelete={onDelete} />);
    fireEvent.press(screen.getByText('删除'));
    expect(onDelete).toHaveBeenCalled();
  });
});
