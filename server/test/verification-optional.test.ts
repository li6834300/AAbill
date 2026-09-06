import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createCaptureMailer } from '../src/mail/mailer.js';
import { createInMemoryRepo } from '../src/repo.js';
import { createInMemoryUserRepo } from '../src/users.js';

// 没有真实发信通道时,要求用户去点一封发不出去的信 = 注册通道彻底不可用。
// 故:配了发信 → 必须验证;没配 → 注册即开通。配上 Resend 后验证自动生效,不改代码。
const SECRET = 'test-secret';
const j = <T>(r: Response) => r.json() as Promise<T>;

const post = (path: string, body: unknown) =>
  new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** verificationRequired=false 模拟"未配发信"的生产环境 */
const makeApp = (verificationRequired: boolean, now?: () => Date) =>
  createApp({
    repo: createInMemoryRepo(),
    userRepo: createInMemoryUserRepo(),
    mailer: createCaptureMailer(),
    verificationRequired,
    jwtSecret: SECRET,
    ...(now ? { now } : {}),
  });

const creds = (email: string) => ({ email, password: 'goodpassword' });

describe('未配发信通道时:注册即开通', () => {
  it('注册直接返回 201 与可用 JWT', async () => {
    const app = makeApp(false);
    const res = await app.request(post('/auth/register', creds('a@example.com')));
    expect(res.status).toBe(201);
    const body = await j<{ token: string; user: { email: string } }>(res);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('a@example.com');
  });

  it('注册后立刻能登录(不被 403 挡)', async () => {
    const app = makeApp(false);
    await app.request(post('/auth/register', creds('a@example.com')));
    const res = await app.request(post('/auth/login', creds('a@example.com')));
    expect(res.status).toBe(200);
  });

  it('注册拿到的 token 能访问受保护路由', async () => {
    const app = makeApp(false);
    const { token } = await j<{ token: string }>(
      await app.request(post('/auth/register', creds('a@example.com'))),
    );
    const res = await app.request(
      new Request('http://x/bills', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('不发验证信(发不出去就别发)', async () => {
    const mailer = createCaptureMailer();
    const app = createApp({
      repo: createInMemoryRepo(),
      userRepo: createInMemoryUserRepo(),
      mailer,
      verificationRequired: false,
      jwtSecret: SECRET,
    });
    await app.request(post('/auth/register', creds('a@example.com')));
    expect(mailer.sent).toHaveLength(0);
  });

  // 免验证不等于免限流:每天 10 个的闸门必须照常生效
  it('仍受每天 10 个上限约束', async () => {
    const app = makeApp(false, () => new Date('2026-09-06T09:00:00Z'));
    for (let i = 0; i < 10; i++) {
      const r = await app.request(post('/auth/register', creds(`u${i}@example.com`)));
      expect(r.status).toBe(201);
    }
    const res = await app.request(post('/auth/register', creds('overflow@example.com')));
    expect(res.status).toBe(429);
  });

  it('邮箱重复仍然 409', async () => {
    const app = makeApp(false);
    await app.request(post('/auth/register', creds('dup@example.com')));
    const res = await app.request(post('/auth/register', creds('dup@example.com')));
    expect(res.status).toBe(409);
  });
});

describe('配了发信通道时:行为不变', () => {
  it('仍返回 202 且必须验证', async () => {
    const app = makeApp(true);
    const res = await app.request(post('/auth/register', creds('a@example.com')));
    expect(res.status).toBe(202);
    const login = await app.request(post('/auth/login', creds('a@example.com')));
    expect(login.status).toBe(403);
  });
});
