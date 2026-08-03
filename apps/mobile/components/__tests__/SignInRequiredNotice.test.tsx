import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { setLang } from '../../lib/i18n';
import { SignInRequiredNotice } from '../SignInRequiredNotice';

// 真实事故:owner 复制了浏览器地址栏的管理页 URL(/bill/id)分享给朋友,
// 朋友打开就撞 401「需要登录」。这是设计陷阱 —— 那不是认领链接。
// 未登录打开管理页时,给一个说得清的引导,而不是突兀的英文报错。

describe('SignInRequiredNotice', () => {
  it('说明这是管理页需登录,并提示认领者去要认领链接', () => {
    setLang('zh');
    render(<SignInRequiredNotice onSignIn={jest.fn()} />);
    // 得让「来认领的朋友」看懂:这链接不对,该找发起人要认领链接
    expect(screen.getByText(/认领链接/)).toBeTruthy();
    expect(screen.getByTestId('goto-signin')).toBeTruthy();
  });

  it('点登录 → 回调(可能是 owner 换了设备)', () => {
    setLang('zh');
    const onSignIn = jest.fn();
    render(<SignInRequiredNotice onSignIn={onSignIn} />);
    fireEvent.press(screen.getByTestId('goto-signin'));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('跟随界面语言(德语)', () => {
    setLang('de');
    render(<SignInRequiredNotice onSignIn={jest.fn()} />);
    expect(screen.getAllByText(/Anmeld/i).length).toBeGreaterThan(0);
  });
});
