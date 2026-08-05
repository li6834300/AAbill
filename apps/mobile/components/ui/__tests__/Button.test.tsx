import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { color } from '../../../theme/tokens';
import { Button } from '../Button';

describe('Button', () => {
  it('禁用状态使用中性灰,不保留主操作的绿色暗示', () => {
    render(<Button testID="disabled-button" label="提交认领" disabled />);

    const button = screen.getByTestId('disabled-button');
    const resolvedStyle =
      typeof button.props.style === 'function'
        ? button.props.style({ pressed: false })
        : button.props.style;

    expect(StyleSheet.flatten(resolvedStyle)).toMatchObject({
      backgroundColor: color.canvasSunk,
      borderColor: color.border,
      borderBottomColor: color.border,
      opacity: 1,
    });
  });
});
