import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { setLang } from '../../lib/i18n';
import { QuotaBadge } from '../QuotaBadge';

// 用户该在点"识别"之前就知道还剩几次,而不是拍完照片才撞 402。
const quota = (
  over: Partial<Parameters<typeof QuotaBadge>[0]['quota']> = {},
) => ({
  plan: 'free' as const,
  limit: 2,
  used: 0,
  remaining: 2,
  resetsAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('QuotaBadge', () => {
  it('还有额度时显示剩余次数', () => {
    setLang('zh');
    render(<QuotaBadge quota={quota({ used: 1, remaining: 1 })} />);
    expect(screen.getByText(/还剩 1 次/)).toBeTruthy();
  });

  it('额度用完时改说用完,并给出恢复日期', () => {
    setLang('zh');
    render(<QuotaBadge quota={quota({ used: 2, remaining: 0 })} />);
    expect(screen.getByText(/已用完/)).toBeTruthy();
    expect(screen.getByText(/恢复/)).toBeTruthy();
  });

  it('免费用户用完时提示可升级 PRO', () => {
    setLang('zh');
    render(<QuotaBadge quota={quota({ used: 2, remaining: 0 })} />);
    expect(screen.getByText(/PRO/)).toBeTruthy();
  });

  // PRO 已经是最高档,再劝升级是噪音
  it('PRO 用完时不提示升级', () => {
    setLang('zh');
    render(
      <QuotaBadge
        quota={quota({ plan: 'pro', limit: 20, used: 20, remaining: 0 })}
      />,
    );
    expect(screen.queryByText(/PRO/)).toBeNull();
  });

  it('跟随界面语言(荷兰语)', () => {
    setLang('nl');
    render(<QuotaBadge quota={quota({ used: 1, remaining: 1 })} />);
    expect(screen.getByText(/Nog 1 AI-scans/)).toBeTruthy();
  });
});
