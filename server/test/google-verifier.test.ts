import { createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createGoogleVerifier } from '../src/auth/google.js';
import { selectVerifier } from '../src/auth/verifier.js';

// Google 登录:客户端拿到 Google 签发的 id token(RS256 JWT),发到服务端;
// 服务端用 Google 公钥(JWKS)验签,并校验 iss / aud(= 我们的 client id)/ email。
// 测试用自签 RSA 密钥 + stub JWKS,跑真实验签路径。

const CLIENT_ID = 'my-client-id.apps.googleusercontent.com';
const JWKS_URI = 'https://test/certs';
const KID = 'test-key-1';

let publicJwk: Record<string, unknown>;
let privatePem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  publicJwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  publicJwk.kid = KID;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
});

const b64 = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64url');

function makeToken(claims: Record<string, unknown>): string {
  const header = { alg: 'RS256', kid: KID, typ: 'JWT' };
  const input = `${b64(header)}.${b64(claims)}`;
  const sig = createSign('RSA-SHA256')
    .update(input)
    .sign(privatePem)
    .toString('base64url');
  return `${input}.${sig}`;
}

const now = () => Math.floor(Date.now() / 1000);
const validClaims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '1234567890',
  email: 'zhien@example.com',
  exp: now() + 3600,
  iat: now(),
  ...over,
});

describe('createGoogleVerifier', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubJwks = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [publicJwk] })),
    );

  const verifier = () => createGoogleVerifier(CLIENT_ID, JWKS_URI);

  it('合法 token:验签通过,返回 sub/email', async () => {
    stubJwks();
    const id = await verifier().verify('google', makeToken(validClaims()));
    expect(id).toEqual({ sub: '1234567890', email: 'zhien@example.com' });
  });

  it('接受 iss = accounts.google.com(无 https 前缀)', async () => {
    stubJwks();
    const id = await verifier().verify(
      'google',
      makeToken(validClaims({ iss: 'accounts.google.com' })),
    );
    expect(id.sub).toBe('1234567890');
  });

  it('aud 不是我们的 client id → 抛错', async () => {
    stubJwks();
    await expect(
      verifier().verify(
        'google',
        makeToken(validClaims({ aud: 'someone-else' })),
      ),
    ).rejects.toThrow();
  });

  it('iss 不是 Google → 抛错', async () => {
    stubJwks();
    await expect(
      verifier().verify('google', makeToken(validClaims({ iss: 'evil.com' }))),
    ).rejects.toThrow();
  });

  it('已过期 → 抛错', async () => {
    stubJwks();
    await expect(
      verifier().verify('google', makeToken(validClaims({ exp: now() - 10 }))),
    ).rejects.toThrow();
  });

  it('缺 email → 抛错', async () => {
    stubJwks();
    const claims = validClaims();
    delete (claims as Record<string, unknown>).email;
    await expect(
      verifier().verify('google', makeToken(claims)),
    ).rejects.toThrow();
  });

  it('签名对不上(用错 kid 找不到公钥)→ 抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ keys: [{ ...publicJwk, kid: 'other' }] }),
      ),
    );
    await expect(
      verifier().verify('google', makeToken(validClaims())),
    ).rejects.toThrow();
  });
});

describe('selectVerifier 走 Google', () => {
  it('有 GOOGLE_CLIENT_ID → 用 Google 校验器(非法 token 直接拒)', async () => {
    const v = selectVerifier({ GOOGLE_CLIENT_ID: CLIENT_ID });
    await expect(v.verify('google', 'not-a-jwt')).rejects.toThrow();
  });

  it('GOOGLE_CLIENT_ID 优先于 ALLOW_DEV_LOGIN', async () => {
    // dev 校验器会把 'a@b.com' 当邮箱通过;Google 校验器会拒。用后者行为区分。
    const v = selectVerifier({
      GOOGLE_CLIENT_ID: CLIENT_ID,
      ALLOW_DEV_LOGIN: '1',
    });
    await expect(v.verify('google', 'a@b.com')).rejects.toThrow();
  });
});
