import { describe, expect, it } from '@jest/globals';
import { setLang } from '../i18n';
import { errorMessage } from '../error-message';

// setError(String(e)) 会把 "Error: fetch failed…" 直接甩给用户。
// errorMessage 把已知失败映射成人话,原始文本留在 raw 里(供"详情"展开)。

describe('errorMessage', () => {
  it('网络失败 → 友好文案 + 保留原文', () => {
    setLang('zh');
    const r = errorMessage(new TypeError('Failed to fetch'));
    expect(r.message).toMatch(/网络|连接/);
    expect(r.raw).toContain('Failed to fetch');
  });

  it('API 401 → 登录失效提示', () => {
    setLang('zh');
    const r = errorMessage(new Error('API 401: unauthorized'));
    expect(r.message).toMatch(/登录|重新/);
    expect(r.raw).toContain('401');
  });

  it('API 409 冲突 → 冲突提示', () => {
    setLang('zh');
    const r = errorMessage(new Error('API 409: conflict'));
    expect(r.message).toMatch(/占用|冲突|变化|刷新/);
  });

  it('未知错误 → 通用文案,但原文可查', () => {
    setLang('zh');
    const r = errorMessage(new Error('boom'));
    expect(r.message).toMatch(/出错|失败|问题/);
    expect(r.raw).toContain('boom');
  });

  it('非 Error 值也能处理', () => {
    setLang('zh');
    const r = errorMessage('plain string');
    expect(r.raw).toContain('plain string');
    expect(typeof r.message).toBe('string');
  });
});
