import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { setLang } from '../../lib/i18n';
import { VerificationNotice } from '../VerificationNotice';

// 注册后必须验证邮箱才能登录。用户此刻最需要知道三件事:
// 信发到哪个邮箱、要去点里面的链接、没收到怎么办。
describe('VerificationNotice', () => {
  it('把信发到的邮箱原样显示出来(便于发现打错字)', () => {
    setLang('zh');
    render(
      <VerificationNotice email="typo@exmaple.com" onResend={jest.fn()} />,
    );
    expect(screen.getByText(/typo@exmaple\.com/)).toBeTruthy();
  });

  it('说明要去邮箱点链接', () => {
    setLang('zh');
    render(<VerificationNotice email="a@example.com" onResend={jest.fn()} />);
    expect(screen.getByText(/验证/)).toBeTruthy();
  });

  it('点重发 → 回调', () => {
    setLang('zh');
    const onResend = jest.fn();
    render(<VerificationNotice email="a@example.com" onResend={onResend} />);
    fireEvent.press(screen.getByTestId('resend-verification'));
    expect(onResend).toHaveBeenCalled();
  });

  it('重发后给出已发送反馈,并禁用按钮防连点', () => {
    setLang('zh');
    render(
      <VerificationNotice email="a@example.com" onResend={jest.fn()} resent />,
    );
    expect(screen.getByText(/已重新发送/)).toBeTruthy();
    expect(screen.getByTestId('resend-verification').props.accessibilityState)
      .toMatchObject({ disabled: true });
  });

  it('跟随界面语言(德语)', () => {
    setLang('de');
    render(<VerificationNotice email="a@example.com" onResend={jest.fn()} />);
    expect(screen.getByText(/E-Mail/)).toBeTruthy();
  });
});
