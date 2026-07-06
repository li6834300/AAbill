import { describe, expect, it } from 'vitest';

// M0 占位测试:仅验证 Vitest 管线跑通,M1 起替换为真实业务测试。
describe('vitest 管线', () => {
  it('能执行并断言', () => {
    expect(1 + 1).toBe(2);
  });
});
