import { createHash } from 'node:crypto';
import type { Plan } from '@aabill/api-types';

export interface User {
  /** 认证主体 = JWT 的 sub。由邮箱推导,与 dev-login 一致(见 subFromEmail)。 */
  id: string;
  email: string;
  /** 邮箱密码用户为 scrypt 串;纯 OAuth 用户为 null。 */
  passwordHash: string | null;
  plan: Plan;
  createdAt: string;
  /** 邮箱验证通过的时刻(ISO);null = 尚未验证,不得登录。 */
  emailVerifiedAt: string | null;
  /** 待验证令牌的哈希(只存哈希,见 auth/verification.ts);null = 无待验证令牌。 */
  verificationTokenHash: string | null;
  verificationExpiresAt: string | null;
}

export interface UserRepo {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  findByVerificationTokenHash(hash: string): Promise<User | undefined>;
  save(user: User): Promise<User>;
  /** 自 sinceIso 起**已验证**的账号数(每日注册名额按此计,未验证的不占)。 */
  countVerifiedSince(sinceIso: string): Promise<number>;
}

/** 邮箱规范化:去首尾空格 + 转小写。存与查都必须过这一层,否则同一人会开出两个号。 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 由邮箱推导认证主体,与 auth/verifier.ts 的 createDevVerifier 保持同一算法。
 * 好处:同一邮箱不论走 dev 登录还是邮箱密码注册,拿到的 sub 一致,
 * 此前建的账单(bills.owner_id)注册后仍归属本人,不会凭空"丢单"。
 */
export function subFromEmail(email: string): string {
  return createHash('sha256')
    .update(normalizeEmail(email))
    .digest('hex')
    .slice(0, 24);
}

export function createInMemoryUserRepo(): UserRepo {
  const byId = new Map<string, User>();
  return {
    async create(user) {
      byId.set(user.id, user);
      return user;
    },
    async findByEmail(email) {
      const wanted = normalizeEmail(email);
      return [...byId.values()].find((u) => u.email === wanted);
    },
    async findById(id) {
      return byId.get(id);
    },
    async findByVerificationTokenHash(hash) {
      return [...byId.values()].find((u) => u.verificationTokenHash === hash);
    },
    async countVerifiedSince(sinceIso) {
      return [...byId.values()].filter(
        (u) => u.emailVerifiedAt !== null && u.emailVerifiedAt >= sinceIso,
      ).length;
    },
    async save(user) {
      byId.set(user.id, user);
      return user;
    },
  };
}
