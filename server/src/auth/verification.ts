import { createHash, randomBytes } from 'node:crypto';

/** 验证链接有效期:24 小时。 */
export const VERIFICATION_TTL_MS = 24 * 3600 * 1000;

/** 生成验证令牌(32 字节随机 → 64 位 hex)。原文只出现在邮件里。 */
export function newVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 库里只存哈希:数据库泄露不该让人能替别人验证邮箱。
 * 令牌本身是高熵随机串,不需要加盐慢哈希(与密码不同,无字典攻击面)。
 */
export function hashVerificationToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** 过期判定。expiresAt 为 null = 没有待验证令牌,一律当过期。 */
export function isVerificationExpired(
  expiresAt: string | null,
  now: Date,
): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}
