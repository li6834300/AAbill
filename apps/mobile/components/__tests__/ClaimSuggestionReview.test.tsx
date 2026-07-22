import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ClaimSuggestionReview } from '../ClaimSuggestionReview';

// PRD 二期 PRO:AI 看照片预选商品,但**必须人工确认**才认领。
// 组件职责:默认全选建议项、可逐项取消、显著提示 AI 可能有误、确认时回传最终选中的 id。

const item = (id: string, name: string, nameZh = '') => ({
  id,
  name,
  nameZh,
  qtyMilli: 1000,
  unit: 'ST',
  unitPriceMilli: 1990,
  taxClass: 'B' as const,
  isShared: false,
  source: 'ai' as const,
});

const items = [
  item('i1', 'ARO MILCH', '牛奶'),
  item('i2', '10er Eier', '鸡蛋'),
];

const base = { items, onConfirm: jest.fn(), onCancel: jest.fn() };

describe('ClaimSuggestionReview', () => {
  it('显著提示这是 AI 识别、可能有误', () => {
    render(<ClaimSuggestionReview {...base} />);
    expect(screen.getByText(/AI/)).toBeTruthy();
    expect(screen.getByText(/可能有误|请.*确认/)).toBeTruthy();
  });

  it('列出建议商品,默认全选;确认时回传全部 id', () => {
    const onConfirm = jest.fn();
    render(<ClaimSuggestionReview {...base} onConfirm={onConfirm} />);
    expect(screen.getByText('ARO MILCH')).toBeTruthy();
    expect(screen.getByText(/牛奶/)).toBeTruthy();
    fireEvent.press(screen.getByText(/确认认领/));
    expect(onConfirm).toHaveBeenCalledWith(['i1', 'i2']);
  });

  it('可取消勾选某项:确认时不含该项', () => {
    const onConfirm = jest.fn();
    render(<ClaimSuggestionReview {...base} onConfirm={onConfirm} />);
    fireEvent.press(screen.getByTestId('suggest-toggle-i1'));
    fireEvent.press(screen.getByText(/确认认领/));
    expect(onConfirm).toHaveBeenCalledWith(['i2']);
  });

  it('全部取消后不能确认(按钮不触发)', () => {
    const onConfirm = jest.fn();
    render(<ClaimSuggestionReview {...base} onConfirm={onConfirm} />);
    fireEvent.press(screen.getByTestId('suggest-toggle-i1'));
    fireEvent.press(screen.getByTestId('suggest-toggle-i2'));
    fireEvent.press(screen.getByText(/确认认领/));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('AI 没认出任何商品:给出说明,不显示确认', () => {
    render(<ClaimSuggestionReview {...base} items={[]} />);
    expect(screen.getByText(/没认出/)).toBeTruthy();
    expect(screen.queryByText(/确认认领/)).toBeNull();
  });

  it('取消触发 onCancel', () => {
    const onCancel = jest.fn();
    render(<ClaimSuggestionReview {...base} onCancel={onCancel} />);
    fireEvent.press(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalled();
  });
});
