import { createHash } from 'node:crypto';

export interface OAuthIdentity {
  sub: string;
  email: string;
}

/** OAuth id token 校验抽象:Google/Apple 真实现待 client id;测试/本地用 mock/dev。 */
export interface IdentityVerifier {
  verify(provider: string, idToken: string): Promise<OAuthIdentity>;
}

/** 测试用:按预置映射把 idToken 换成身份,未命中即抛错。 */
export function createMockVerifier(
  map: Record<string, OAuthIdentity>,
): IdentityVerifier {
  return {
    async verify(_provider, idToken) {
      const id = map[idToken];
      if (!id) throw new Error('无效的 id token');
      return id;
    },
  };
}

/**
 * 开发登录:idToken 直接当邮箱,sub 由邮箱哈希得到。
 * 仅在 ALLOW_DEV_LOGIN=1 时启用 —— 生产绝不可开(否则任意邮箱即可登录)。
 */
export function createDevVerifier(): IdentityVerifier {
  return {
    async verify(_provider, idToken) {
      const email = idToken.trim();
      if (!email.includes('@')) throw new Error('dev 登录需提供邮箱');
      const sub = createHash('sha256').update(email).digest('hex').slice(0, 24);
      return { sub, email };
    },
  };
}

/**
 * 生产 Google/Apple 校验待接线(需 client id 作 audience,走 JWKS 验签)。
 * 目前抛错并提示,避免"看起来能用其实没验证"。
 */
export function createUnconfiguredVerifier(): IdentityVerifier {
  return {
    async verify() {
      throw new Error('未配置 OAuth 校验(缺 Google/Apple client id)');
    },
  };
}

/** 按环境选 verifier:ALLOW_DEV_LOGIN=1 → dev,否则未配置(拒绝)。 */
export function selectVerifier(
  env: Record<string, string | undefined>,
): IdentityVerifier {
  if (env.ALLOW_DEV_LOGIN === '1') return createDevVerifier();
  return createUnconfiguredVerifier();
}
