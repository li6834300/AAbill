import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';
import { createInMemoryUserRepo } from '../src/users.js';

// 生产此前无可用登录方式(未配 GOOGLE_CLIENT_ID,且禁开 ALLOW_DEV_LOGIN),
// 任何人都换不到 JWT,请求 /bills 一律 401「需要登录」。本轮补上邮箱+密码注册登录。
const SECRET = 'test-secret-please-rotate';
const j = <T>(r: Response) => r.json() as Promise<T>;

const post = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const makeApp = () =>
  createApp({
    repo: createInMemoryRepo(),
    userRepo: createInMemoryUserRepo(),
    jwtSecret: SECRET,
  });

type SessionRes = {
  token: string;
  user: { sub: string; email: string; plan: string };
};

describe('邮箱密码注册', () => {
  it('注册成功返回 JWT 与用户,默认 free 套餐', async () => {
    const app = makeApp();
    const res = await app.request(
      post('/auth/register', {
        email: 'new@example.com',
        password: 'goodpassword',
      }),
    );
    expect(res.status).toBe(201);
    const body = await j<SessionRes>(res);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('new@example.com');
    expect(body.user.plan).toBe('free');
  });

  it('注册拿到的 token 能直接访问受保护路由', async () => {
    const app = makeApp();
    const { token } = await j<SessionRes>(
      await app.request(
        post('/auth/register', {
          email: 'a@example.com',
          password: 'goodpassword',
        }),
      ),
    );
    const res = await app.request(
      new Request('http://x/bills', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('邮箱重复注册返回 409', async () => {
    const app = makeApp();
    const body = { email: 'dup@example.com', password: 'goodpassword' };
    expect((await app.request(post('/auth/register', body))).status).toBe(201);
    expect((await app.request(post('/auth/register', body))).status).toBe(409);
  });

  it('邮箱大小写与首尾空格规范化后仍算重复', async () => {
    const app = makeApp();
    await app.request(
      post('/auth/register', {
        email: 'Case@Example.com',
        password: 'goodpassword',
      }),
    );
    const res = await app.request(
      post('/auth/register', {
        email: '  case@example.COM  ',
        password: 'goodpassword',
      }),
    );
    expect(res.status).toBe(409);
  });

  it('密码短于 8 位返回 400', async () => {
    const app = makeApp();
    const res = await app.request(
      post('/auth/register', {
        email: 'short@example.com',
        password: 'abc123',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('邮箱格式非法返回 400', async () => {
    const app = makeApp();
    const res = await app.request(
      post('/auth/register', {
        email: 'not-an-email',
        password: 'goodpassword',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('响应里绝不出现密码或哈希', async () => {
    const app = makeApp();
    const raw = await (
      await app.request(
        post('/auth/register', {
          email: 'leak@example.com',
          password: 'goodpassword',
        }),
      )
    ).text();
    expect(raw).not.toContain('goodpassword');
    expect(raw).not.toContain('scrypt$');
    expect(raw).not.toContain('passwordHash');
  });
});

describe('邮箱密码登录', () => {
  const creds = { email: 'user@example.com', password: 'goodpassword' };
  async function appWithUser() {
    const app = makeApp();
    await app.request(post('/auth/register', creds));
    return app;
  }

  it('正确凭据登录成功', async () => {
    const app = await appWithUser();
    const res = await app.request(post('/auth/login', creds));
    expect(res.status).toBe(200);
    expect((await j<SessionRes>(res)).user.email).toBe(creds.email);
  });

  it('密码错误返回 401', async () => {
    const app = await appWithUser();
    const res = await app.request(
      post('/auth/login', { ...creds, password: 'wrongpassword' }),
    );
    expect(res.status).toBe(401);
  });

  it('邮箱不存在返回 401', async () => {
    const app = await appWithUser();
    const res = await app.request(
      post('/auth/login', {
        email: 'nobody@example.com',
        password: 'goodpassword',
      }),
    );
    expect(res.status).toBe(401);
  });

  // 两种失败的响应必须一模一样,否则能被用来枚举哪些邮箱已注册
  it('密码错与账号不存在的错误信息完全相同', async () => {
    const app = await appWithUser();
    const wrongPass = await app.request(
      post('/auth/login', { ...creds, password: 'wrongpassword' }),
    );
    const noUser = await app.request(
      post('/auth/login', {
        email: 'nobody@example.com',
        password: 'goodpassword',
      }),
    );
    expect(wrongPass.status).toBe(noUser.status);
    expect(await wrongPass.text()).toBe(await noUser.text());
  });

  it('登录邮箱大小写不敏感', async () => {
    const app = await appWithUser();
    const res = await app.request(
      post('/auth/login', {
        email: 'USER@EXAMPLE.COM',
        password: creds.password,
      }),
    );
    expect(res.status).toBe(200);
  });

  it('同一账号两次登录都能拿到可用 token', async () => {
    const app = await appWithUser();
    const first = await j<SessionRes>(
      await app.request(post('/auth/login', creds)),
    );
    const second = await j<SessionRes>(
      await app.request(post('/auth/login', creds)),
    );
    for (const tk of [first.token, second.token]) {
      const res = await app.request(
        new Request('http://x/bills', {
          headers: { authorization: `Bearer ${tk}` },
        }),
      );
      expect(res.status).toBe(200);
    }
  });

  // sub 沿用 dev-login 的推导方式(sha256(email) 前 24 位),
  // 这样同一邮箱在本地 dev 登录期间建的账单,注册后仍归属本人。
  it('sub 由邮箱推导,与 dev-login 一致', async () => {
    const app = await appWithUser();
    const viaLogin = await j<SessionRes>(
      await app.request(post('/auth/login', creds)),
    );
    const devApp = createApp({
      repo: createInMemoryRepo(),
      userRepo: createInMemoryUserRepo(),
      jwtSecret: SECRET,
      verifier: {
        async verify(_p, idToken) {
          const { createDevVerifier } = await import('../src/auth/verifier.js');
          return createDevVerifier().verify(_p, idToken);
        },
      },
    });
    const viaDev = await j<SessionRes>(
      await devApp.request(
        post('/auth/session', { provider: 'dev', idToken: creds.email }),
      ),
    );
    expect(viaLogin.user.sub).toBe(viaDev.user.sub);
  });
});
