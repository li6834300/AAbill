import { sign, verify } from 'hono/jwt';

export interface AuthUser {
  sub: string;
  email: string;
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 3600; // 30 天

/** 签发应用 JWT(HS256),载荷含 sub/email + 过期时间。 */
export function issueToken(
  user: AuthUser,
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return sign(
    {
      sub: user.sub,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    },
    secret,
    'HS256',
  );
}

/** 校验 JWT,通过返回用户,失败(过期/篡改/错误密钥/非法)返回 null。 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<AuthUser | null> {
  try {
    const payload = await verify(token, secret, 'HS256');
    if (typeof payload.sub === 'string' && typeof payload.email === 'string') {
      return { sub: payload.sub, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}
