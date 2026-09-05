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
}

export interface UserRepo {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  save(user: User): Promise<User>;
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
    async save(user) {
      byId.set(user.id, user);
      return user;
    },
  };
}
