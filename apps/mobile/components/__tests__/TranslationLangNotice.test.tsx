import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { setLang } from '../../lib/i18n';
import { TranslationLangNotice } from '../TranslationLangNotice';

// 用户选的是方案 B:切界面语言不重译商品名。
// 那就必须让用户知道「为什么商品名还是另一种语言」以及「怎么办」。

describe('TranslationLangNotice', () => {
  it('账单语言与界面语言一致 → 不打扰', () => {
    setLang('zh');
    render(<TranslationLangNotice billLang="zh" onRescan={jest.fn()} />);
    expect(screen.queryByTestId('translation-lang-notice')).toBeNull();
  });

  it('还没识别过(null)→ 不打扰', () => {
    setLang('zh');
    render(<TranslationLangNotice billLang={null} onRescan={jest.fn()} />);
    expect(screen.queryByTestId('translation-lang-notice')).toBeNull();
  });

  it('语言不一致 → 说明现状并给出重新识别入口', () => {
    setLang('zh');
    render(<TranslationLangNotice billLang="de" onRescan={jest.fn()} />);
    expect(screen.getByTestId('translation-lang-notice')).toBeTruthy();
    // 得说清是哪种语言,以及重新识别会怎样
    expect(screen.getByText(/德语|Deutsch/)).toBeTruthy();
  });

  it('点重新识别 → 回调', () => {
    setLang('nl');
    const onRescan = jest.fn();
    render(<TranslationLangNotice billLang="zh" onRescan={onRescan} />);
    fireEvent.press(screen.getByTestId('rescan-for-lang'));
    expect(onRescan).toHaveBeenCalled();
  });

  it('识别中不可重复点', () => {
    setLang('nl');
    const onRescan = jest.fn();
    render(<TranslationLangNotice billLang="zh" onRescan={onRescan} busy />);
    fireEvent.press(screen.getByTestId('rescan-for-lang'));
    expect(onRescan).not.toHaveBeenCalled();
  });
});
