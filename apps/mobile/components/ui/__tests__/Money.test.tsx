import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Money } from '../Money';

// Money 原语:金额 + 币种符号必须是**同一个 Text 节点**。
// SettlementTable 的测试用 getByText('6.55 €') 精确匹配整串,
// 若拆成两个 Text(数字/符号分开)那些断言全挂 —— 这是硬约束。

describe('Money', () => {
  it('把整数分渲染成单节点 "6.55 €"', () => {
    render(<Money cents={655} />);
    expect(screen.getByText('6.55 €')).toBeTruthy();
  });

  it('负数带符号,仍是单节点', () => {
    render(<Money cents={-558} />);
    expect(screen.getByText('-5.58 €')).toBeTruthy();
  });

  it('零', () => {
    render(<Money cents={0} />);
    expect(screen.getByText('0.00 €')).toBeTruthy();
  });

  it('大号变体不改变文本内容(还是单节点)', () => {
    render(<Money cents={1492} size="lg" />);
    expect(screen.getByText('14.92 €')).toBeTruthy();
  });

  it('可换币种符号', () => {
    render(<Money cents={100} currency="$" />);
    expect(screen.getByText('1.00 $')).toBeTruthy();
  });
});
