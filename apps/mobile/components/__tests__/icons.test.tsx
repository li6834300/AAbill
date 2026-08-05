import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Check, ChevronRight, Plus, Warning } from '../icons';

// 冒烟测试:确认 react-native-svg 在 RNTL(jest-expo)下能渲染,
// 决定是否需要在 jest.setup 里加 mock。能过 = 不需要 mock。

describe('icons (react-native-svg smoke test)', () => {
  it('渲染不抛错并带无障碍标签', () => {
    const { getByLabelText } = render(<Check title="已完成" />);
    expect(getByLabelText('已完成')).toBeTruthy();
  });

  it('装饰性图标(无 title)也能渲染', () => {
    expect(() =>
      render(
        <>
          <ChevronRight />
          <Plus />
          <Warning color="#B4442E" size={24} />
        </>,
      ),
    ).not.toThrow();
  });
});
