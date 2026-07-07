import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { FamilyChips } from '../FamilyChips';

// PRD B2:家庭用真实名字(Rio家、老唐家……),可增删。

const families = [
  { id: 'f1', name: 'Rio家', sortOrder: 0 },
  { id: 'f2', name: '老唐家', sortOrder: 1 },
];

describe('FamilyChips', () => {
  it('渲染全部家庭名', () => {
    render(
      <FamilyChips
        families={families}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.getByText('Rio家')).toBeTruthy();
    expect(screen.getByText('老唐家')).toBeTruthy();
  });

  it('输入名字点添加 → onAdd(name) 并清空输入', () => {
    const onAdd = jest.fn();
    render(
      <FamilyChips families={families} onAdd={onAdd} onRemove={jest.fn()} />,
    );
    const input = screen.getByTestId('family-input');
    fireEvent.changeText(input, 'Yuxi家');
    fireEvent.press(screen.getByText('添加'));
    expect(onAdd).toHaveBeenCalledWith('Yuxi家');
    expect(input.props.value).toBe('');
  });

  it('空输入点添加不触发', () => {
    const onAdd = jest.fn();
    render(
      <FamilyChips families={families} onAdd={onAdd} onRemove={jest.fn()} />,
    );
    fireEvent.press(screen.getByText('添加'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('点家庭的删除 → onRemove(id)', () => {
    const onRemove = jest.fn();
    render(
      <FamilyChips families={families} onAdd={jest.fn()} onRemove={onRemove} />,
    );
    fireEvent.press(screen.getByTestId('remove-family-f1'));
    expect(onRemove).toHaveBeenCalledWith('f1');
  });
});
