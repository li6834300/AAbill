import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createCaptureMailer } from '../src/mail/mailer.js';
import { createInMemoryRepo } from '../src/repo.js';
import { createInMemoryUserRepo, type UserRepo } from '../src/users.js';
import { createMockVerifier } from '../src/auth/verifier.js';

// 注册免费 → 必须验证邮箱才能登录。每天最多 10 个**已验证**账号:
// 未验证的注册不占名额,否则有人用 10 个假邮箱刷一下,真用户一整天都注册不了。
const SECRET = 'test-secret';
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

function makeApp(opts: { userRepo?: UserRepo; now?: () => Date } = {}) {
  const mailer = createCaptureMailer();
  const app = createApp({
    repo: createInMemoryRepo(),
    userRepo: opts.userRepo ?? createInMemoryUserRepo(),
    mailer,
    jwtSecret: SECRET,
    appBaseUrl: 'https://app.test',
    verifier: createMockVerifier({
      'tok-g': { sub: 'g-sub', email: 'google-user@example.com' },
    }),
    ...(opts.now ? { now: opts.now } : {}),
  });
  return { app, mailer };
}

const creds = (email: string) => ({ email, password: 'goodpassword' });

/** 从最后一封信里抠出验证令牌 */
function tokenFromMail(mailer: ReturnType<typeof createCaptureMailer>): string {
  const last = mailer.sent.at(-1);
  const m = /token=([0-9a-f]{64})/.exec(last?.text ?? '');
  if (!m) throw new Error(`信里没有验证令牌: ${last?.text}`);
  return m[1]!;
}

describe('注册需验证邮箱', () => {
  it('注册返回 202 且不签发 JWT(还不能用)', async () => {
    const { app } = makeApp();
    const res = await app.request(
      post('/auth/register', creds('a@example.com')),
    );
    expect(res.status).toBe(202);
    const body = await j<Record<string, unknown>>(res);
    expect(body.token).toBeUndefined();
    expect(body.pendingVerification).toBe(true);
  });

  it('注册后发出一封含验证链接的信', async () => {
    const { app, mailer } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.to).toBe('a@example.com');
    expect(mailer.sent[0]!.text).toContain('https://app.test/verify?token=');
  });

  it('未验证不能登录(403,且说明原因可重发)', async () => {
    const { app } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    const res = await app.request(post('/auth/login', creds('a@example.com')));
    expect(res.status).toBe(403);
    expect((await j<{ error: string }>(res)).error).toContain('验证');
  });

  it('点验证链接 → 验证通过并直接签发 JWT', async () => {
    const { app, mailer } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    const res = await app.request(
      post('/auth/verify', { token: tokenFromMail(mailer) }),
    );
    expect(res.status).toBe(200);
    const body = await j<{ token: string; user: { email: string } }>(res);
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('a@example.com');
  });

  it('验证后即可正常登录', async () => {
    const { app, mailer } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    await app.request(post('/auth/verify', { token: tokenFromMail(mailer) }));
    expect(
      (await app.request(post('/auth/login', creds('a@example.com')))).status,
    ).toBe(200);
  });

  it('伪造令牌 400', async () => {
    const { app } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    const res = await app.request(
      post('/auth/verify', { token: 'f'.repeat(64) }),
    );
    expect(res.status).toBe(400);
  });

  it('令牌只能用一次', async () => {
    const { app, mailer } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    const tk = tokenFromMail(mailer);
    expect(
      (await app.request(post('/auth/verify', { token: tk }))).status,
    ).toBe(200);
    expect(
      (await app.request(post('/auth/verify', { token: tk }))).status,
    ).toBe(400);
  });

  it('过期令牌 400', async () => {
    let clock = new Date('2026-09-05T00:00:00Z');
    const { app, mailer } = makeApp({ now: () => clock });
    await app.request(post('/auth/register', creds('a@example.com')));
    const tk = tokenFromMail(mailer);
    clock = new Date('2026-09-06T00:00:01Z'); // 超过 24h
    expect(
      (await app.request(post('/auth/verify', { token: tk }))).status,
    ).toBe(400);
  });

  it('可重发验证信,旧令牌随即失效', async () => {
    const { app, mailer } = makeApp();
    await app.request(post('/auth/register', creds('a@example.com')));
    const old = tokenFromMail(mailer);
    await app.request(
      post('/auth/resend-verification', { email: 'a@example.com' }),
    );
    const fresh = tokenFromMail(mailer);
    expect(fresh).not.toBe(old);
    expect(
      (await app.request(post('/auth/verify', { token: old }))).status,
    ).toBe(400);
    expect(
      (await app.request(post('/auth/verify', { token: fresh }))).status,
    ).toBe(200);
  });

  // 重发接口不能用来探测哪些邮箱注册过
  it('对未注册邮箱重发也返回 202,不泄露存在性', async () => {
    const { app, mailer } = makeApp();
    const res = await app.request(
      post('/auth/resend-verification', { email: 'nobody@example.com' }),
    );
    expect(res.status).toBe(202);
    expect(mailer.sent).toHaveLength(0);
  });

  // Google 的邮箱已由 Google 验过,再要求验证是多余的
  it('OAuth 登录的用户自动算已验证', async () => {
    const { app } = makeApp();
    const res = await app.request(
      post('/auth/session', { provider: 'mock', idToken: 'tok-g' }),
    );
    expect(res.status).toBe(200);
    expect((await j<{ token: string }>(res)).token).toBeTruthy();
  });
});

describe('每天 10 个已验证账号上限', () => {
  const day = (n: number) => new Date(`2026-09-0${n}T09:00:00Z`);

  /** 注册并完成验证 */
  async function signUp(
    app: ReturnType<typeof makeApp>['app'],
    mailer: ReturnType<typeof createCaptureMailer>,
    email: string,
  ) {
    const reg = await app.request(post('/auth/register', creds(email)));
    if (reg.status !== 202) return reg;
    return app.request(post('/auth/verify', { token: tokenFromMail(mailer) }));
  }

  it('第 10 个能验证成功,第 11 个被拒(429)', async () => {
    const { app, mailer } = makeApp({ now: () => day(5) });
    for (let i = 0; i < 10; i++) {
      const r = await signUp(app, mailer, `u${i}@example.com`);
      expect(r.status).toBe(200);
    }
    const res = await signUp(app, mailer, 'overflow@example.com');
    expect(res.status).toBe(429);
  });

  it('名额满时注册就被挡下(不必等收信点链接)', async () => {
    const { app, mailer } = makeApp({ now: () => day(5) });
    for (let i = 0; i < 10; i++) await signUp(app, mailer, `u${i}@example.com`);
    const res = await app.request(
      post('/auth/register', creds('late@example.com')),
    );
    expect(res.status).toBe(429);
    expect((await j<{ error: string }>(res)).error).toContain('名额');
  });

  // 未验证的注册不占名额 —— 否则 10 个假邮箱就能锁死一整天
  it('未验证的注册不消耗名额', async () => {
    const { app, mailer } = makeApp({ now: () => day(5) });
    for (let i = 0; i < 20; i++) {
      await app.request(
        post('/auth/register', creds(`pending${i}@example.com`)),
      );
    }
    // 20 个待验证挂着,真实用户仍能注册并验证
    expect((await signUp(app, mailer, 'real@example.com')).status).toBe(200);
  });

  it('隔天名额重置', async () => {
    let clock = day(5);
    const { app, mailer } = makeApp({ now: () => clock });
    for (let i = 0; i < 10; i++) await signUp(app, mailer, `u${i}@example.com`);
    expect((await signUp(app, mailer, 'blocked@example.com')).status).toBe(429);

    clock = day(6);
    expect((await signUp(app, mailer, 'nextday@example.com')).status).toBe(200);
  });

  // 名额满时不该作废用户手上的链接:第二天还能用
  it('因名额被拒的令牌次日仍可验证', async () => {
    let clock = day(5);
    const { app, mailer } = makeApp({ now: () => clock });
    // 先拿到一个令牌(此时名额还空着)
    await app.request(post('/auth/register', creds('early@example.com')));
    const tk = tokenFromMail(mailer);
    // 名额被别人占满
    for (let i = 0; i < 10; i++) await signUp(app, mailer, `u${i}@example.com`);
    expect(
      (await app.request(post('/auth/verify', { token: tk }))).status,
    ).toBe(429);

    clock = new Date('2026-09-05T23:00:00Z'); // 仍在 24h 内、但换天前
    clock = day(6);
    // 次日名额重置,但令牌已过 24h 吗?注册于 09-05T09:00,到 09-06T09:00 恰好 24h → 过期
    // 故这里用刚好未过期的时刻验证
    clock = new Date('2026-09-06T08:59:00Z');
    expect(
      (await app.request(post('/auth/verify', { token: tk }))).status,
    ).toBe(200);
  });
});
