import { describe, expect, it } from 'vitest';
import {
  VERIFICATION_TTL_MS,
  hashVerificationToken,
  isVerificationExpired,
  newVerificationToken,
} from '../src/auth/verification.js';

// 令牌只在库里存哈希:数据库泄露不该让人能替别人验证邮箱。
describe('邮箱验证令牌', () => {
  it('每次生成都不同', () => {
    expect(newVerificationToken()).not.toBe(newVerificationToken());
  });

  it('长度足够抗猜(>= 32 字节的 hex)', () => {
    expect(newVerificationToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('哈希稳定且不可由哈希反推原文', () => {
    const raw = newVerificationToken();
    expect(hashVerificationToken(raw)).toBe(hashVerificationToken(raw));
    expect(hashVerificationToken(raw)).not.toBe(raw);
  });

  it('不同令牌哈希不同', () => {
    expect(hashVerificationToken('a')).not.toBe(hashVerificationToken('b'));
  });

  it('有效期 24 小时', () => {
    expect(VERIFICATION_TTL_MS).toBe(24 * 3600 * 1000);
  });

  describe('过期判定', () => {
    const now = new Date('2026-09-05T12:00:00Z');

    it('未到期不算过期', () => {
      expect(isVerificationExpired('2026-09-05T12:00:01Z', now)).toBe(false);
    });

    it('恰好到期算过期', () => {
      expect(isVerificationExpired('2026-09-05T12:00:00Z', now)).toBe(true);
    });

    it('已过期', () => {
      expect(isVerificationExpired('2026-09-04T12:00:00Z', now)).toBe(true);
    });

    // 没有过期时间 = 没有待验证令牌,一律当过期,不能放行
    it('过期时间为 null 时当作过期', () => {
      expect(isVerificationExpired(null, now)).toBe(true);
    });
  });
});
