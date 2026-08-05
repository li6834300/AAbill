import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Stepper } from '../Stepper';

// Stepper 原语:把 ClaimItemRow 里散写的加减夹逼逻辑抽出来。
// 规格由现有 ClaimItemRow 测试隐含定义:不能超过 max、不能低于 min(0)。
// testID 可注入,让 ClaimItemRow 继续用 dec-{id}/inc-{id}。

const setup = (props: Partial<React.ComponentProps<typeof Stepper>> = {}) => {
  const onChange = jest.fn();
  render(
    <Stepper
      value={props.value ?? 0}
      max={props.max ?? 10}
      onChange={onChange}
      decTestID="dec-x"
      incTestID="inc-x"
      {...props}
    />,
  );
  return { onChange };
};

describe('Stepper', () => {
  it('加号回传 value+1', () => {
    const { onChange } = setup({ value: 2 });
    fireEvent.press(screen.getByTestId('inc-x'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('减号回传 value-1', () => {
    const { onChange } = setup({ value: 2 });
    fireEvent.press(screen.getByTestId('dec-x'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('到达 max 时加号不触发', () => {
    const { onChange } = setup({ value: 10, max: 10 });
    fireEvent.press(screen.getByTestId('inc-x'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('到达 min(默认 0)时减号不触发', () => {
    const { onChange } = setup({ value: 0 });
    fireEvent.press(screen.getByTestId('dec-x'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('禁用时两个按钮都不触发', () => {
    const { onChange } = setup({ value: 3, disabled: true });
    fireEvent.press(screen.getByTestId('inc-x'));
    fireEvent.press(screen.getByTestId('dec-x'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
