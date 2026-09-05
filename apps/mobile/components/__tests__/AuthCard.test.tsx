import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { setLang } from '../../lib/i18n';
import { AuthCard } from '../AuthCard';

// 生产此前没有任何可用登录方式,用户只能撞 401。这是第一条能自助注册进来的路径。
// 注册免费,登录后每月有 AI 识别额度(免费 2 次 / PRO 20 次)。

const noop = async () => {};

describe('AuthCard', () => {
  it('默认登录模式,提交带 login', () => {
    setLang('zh');
    const onSubmit = jest.fn(noop);
    render(<AuthCard onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByTestId('auth-email'), 'a@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'goodpassword');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      'login',
      'a@example.com',
      'goodpassword',
    );
  });

  it('切到注册模式后提交带 register', () => {
    setLang('zh');
    const onSubmit = jest.fn(noop);
    render(<AuthCard onSubmit={onSubmit} />);
    fireEvent.press(screen.getByTestId('auth-switch'));
    fireEvent.changeText(screen.getByTestId('auth-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'goodpassword');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      'register',
      'new@example.com',
      'goodpassword',
    );
  });

  it('邮箱或密码为空时不提交', () => {
    setLang('zh');
    const onSubmit = jest.fn(noop);
    render(<AuthCard onSubmit={onSubmit} />);
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('auth-email'), 'a@example.com');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // 服务端要求 8 位;在本地先拦一道,省一次往返也说得更清楚
  it('注册时密码短于 8 位本地拦下并提示', () => {
    setLang('zh');
    const onSubmit = jest.fn(noop);
    render(<AuthCard onSubmit={onSubmit} />);
    fireEvent.press(screen.getByTestId('auth-switch'));
    fireEvent.changeText(screen.getByTestId('auth-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'short');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/至少 8 位/)).toBeTruthy();
  });

  it('邮箱首尾空格提交前去掉', () => {
    setLang('zh');
    const onSubmit = jest.fn(noop);
    render(<AuthCard onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByTestId('auth-email'), '  a@example.com  ');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'goodpassword');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      'login',
      'a@example.com',
      'goodpassword',
    );
  });

  it('密码框遮挡输入', () => {
    setLang('zh');
    render(<AuthCard onSubmit={jest.fn(noop)} />);
    expect(screen.getByTestId('auth-password').props.secureTextEntry).toBe(
      true,
    );
  });

  it('显示外部传入的错误(如邮箱已注册)', () => {
    setLang('zh');
    render(
      <AuthCard onSubmit={jest.fn(noop)} error="该邮箱已注册,请直接登录" />,
    );
    expect(screen.getByText(/已注册/)).toBeTruthy();
  });

  it('切换模式会清掉上一次的本地校验提示', () => {
    setLang('zh');
    render(<AuthCard onSubmit={jest.fn(noop)} />);
    fireEvent.press(screen.getByTestId('auth-switch'));
    fireEvent.changeText(screen.getByTestId('auth-email'), 'n@example.com');
    fireEvent.changeText(screen.getByTestId('auth-password'), 'short');
    fireEvent.press(screen.getByTestId('auth-submit'));
    expect(screen.getByText(/至少 8 位/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('auth-switch')); // 切回登录
    expect(screen.queryByText(/至少 8 位/)).toBeNull();
  });

  it('跟随界面语言(英语)', () => {
    setLang('en');
    render(<AuthCard onSubmit={jest.fn(noop)} />);
    // 断言唯一出现一次的切换链接:标题与按钮同为 "Sign in",指名道姓才不歧义
    expect(screen.getByText('No account yet? Sign up free')).toBeTruthy();
  });
});
