import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { BlockingWaitOverlay } from '../BlockingWaitOverlay';

describe('BlockingWaitOverlay', () => {
  it('隐藏时不占据界面', () => {
    render(
      <BlockingWaitOverlay
        visible={false}
        title="请稍候"
        message="正在保存…"
      />,
    );

    expect(screen.queryByTestId('blocking-wait-overlay')).toBeNull();
  });

  it('通讯中显示醒目的阻断层与当前操作', () => {
    render(
      <BlockingWaitOverlay
        visible
        title="请稍候"
        message="正在添加家庭…"
      />,
    );

    expect(screen.getByTestId('blocking-wait-overlay')).toBeTruthy();
    expect(screen.getByTestId('blocking-wait-spinner')).toBeTruthy();
    expect(screen.getByText('请稍候')).toBeTruthy();
    expect(screen.getByText('正在添加家庭…')).toBeTruthy();
  });

  it('AI 处理使用专属醒目状态', () => {
    render(
      <BlockingWaitOverlay
        visible
        variant="ai"
        title="AI 正在处理发票"
        message="正在识别商品和金额…"
      />,
    );

    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('AI 正在处理发票')).toBeTruthy();
  });
});
