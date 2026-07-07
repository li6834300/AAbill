import { describe, expect, it } from 'vitest';
import { createMockVerifier, selectVerifier } from '../src/auth/verifier.js';
import { issueToken, verifyToken } from '../src/auth/jwt.js';
import { createApp } from '../src/app.js';
import { createInMemoryRepo } from '../src/repo.js';

// PRD §5.3 / ADR 0004 待接线:Owner 靠 JWT;Participant 靠 share_token。
// 本轮补上目前最大的安全洞 —— 此前持 bill.id 谁都能改账单。
// OAuth id token 校验抽象为 verifier(测试用 mock,Google/Apple 真实现待 client id)。

const SECRET = 'test-secret-please-rotate';

const j = <T>(r: Response) => r.json() as Promise<T>;
type Obj = Record<string, unknown> & { id: string };

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

/** 建 app + mock verifier(tok-alice → alice,tok-bob → bob) */
function makeApp() {
  return createApp({
    repo: createInMemoryRepo(),
    jwtSecret: SECRET,
    verifier: createMockVerifier({
      'tok-alice': { sub: 'alice', email: 'alice@example.com' },
      'tok-bob': { sub: 'bob', email: 'bob@example.com' },
    }),
  });
}

async function login(app: ReturnType<typeof makeApp>, idToken: string) {
  const res = await app.request(
    post('/auth/session', { provider: 'mock', idToken }),
  );
  return j<{ token: string; user: { sub: string; email: string } }>(res);
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('jwt 签发与校验', () => {
  it('往返:issue 出的 token verify 能还原用户', async () => {
    const token = await issueToken(
      { sub: 'alice', email: 'alice@example.com' },
      SECRET,
    );
    expect(await verifyToken(token, SECRET)).toMatchObject({
      sub: 'alice',
      email: 'alice@example.com',
    });
  });

  it('错误密钥 / 篡改 / 垃圾串 → null', async () => {
    const token = await issueToken({ sub: 'a', email: 'a@x' }, SECRET);
    expect(await verifyToken(token, 'wrong-secret')).toBeNull();
    expect(await verifyToken(token + 'x', SECRET)).toBeNull();
    expect(await verifyToken('not-a-jwt', SECRET)).toBeNull();
  });
});

describe('verifier 选择', () => {
  it('ALLOW_DEV_LOGIN=1 → dev;否则无 dev', async () => {
    const dev = selectVerifier({ ALLOW_DEV_LOGIN: '1' });
    const id = await dev.verify('dev', 'alice@example.com');
    expect(id.email).toBe('alice@example.com');
    expect(id.sub).toBeTruthy();
    await expect(
      selectVerifier({}).verify('dev', 'alice@example.com'),
    ).rejects.toThrow();
  });
});

describe('POST /auth/session', () => {
  it('有效 id token → 签发 app JWT + 用户', async () => {
    const app = makeApp();
    const { token, user } = await login(app, 'tok-alice');
    expect(user).toEqual({ sub: 'alice', email: 'alice@example.com' });
    expect(await verifyToken(token, SECRET)).toMatchObject({ sub: 'alice' });
  });

  it('无效 id token → 401', async () => {
    const app = makeApp();
    const res = await app.request(
      post('/auth/session', { provider: 'mock', idToken: 'bogus' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('Owner 路由需要 JWT', () => {
  it('无 token 建单 → 401;有 token → 201 且账单归属该 owner', async () => {
    const app = makeApp();
    expect(
      (await app.request(post('/bills', { title: 'X', taxCountry: 'DE' })))
        .status,
    ).toBe(401);

    const { token } = await login(app, 'tok-alice');
    const res = await app.request(
      post('/bills', { title: 'X', taxCountry: 'DE' }, bearer(token)),
    );
    expect(res.status).toBe(201);
    expect((await j<Obj & { ownerId: string }>(res)).ownerId).toBe('alice');
  });

  it('列表只返回自己的账单', async () => {
    const app = makeApp();
    const alice = await login(app, 'tok-alice');
    const bob = await login(app, 'tok-bob');
    await app.request(
      post('/bills', { title: 'A 的', taxCountry: 'DE' }, bearer(alice.token)),
    );
    await app.request(
      post('/bills', { title: 'B 的', taxCountry: 'NL' }, bearer(bob.token)),
    );

    const list = await j<{ bills: Obj[] }>(
      await app.request(
        new Request('http://x/bills', { headers: bearer(bob.token) }),
      ),
    );
    expect(list.bills).toHaveLength(1);
    expect(list.bills[0]).toMatchObject({ title: 'B 的' });
  });

  it('访问别人的账单 → 404(不泄露存在性)', async () => {
    const app = makeApp();
    const alice = await login(app, 'tok-alice');
    const bob = await login(app, 'tok-bob');
    const bill = await j<Obj>(
      await app.request(
        post('/bills', { title: 'A 的', taxCountry: 'DE' }, bearer(alice.token)),
      ),
    );
    expect(
      (
        await app.request(
          new Request(`http://x/bills/${bill.id}`, { headers: bearer(bob.token) }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          post(
            `/bills/${bill.id}/items`,
            { name: 'x', qtyMilli: 1000, unitPriceMilli: 100, taxClass: 'A' },
            bearer(bob.token),
          ),
        )
      ).status,
    ).toBe(404);
  });

  it('own 账单读写正常', async () => {
    const app = makeApp();
    const { token } = await login(app, 'tok-alice');
    const bill = await j<Obj>(
      await app.request(
        post('/bills', { title: 'A 的', taxCountry: 'DE' }, bearer(token)),
      ),
    );
    expect(
      (
        await app.request(
          new Request(`http://x/bills/${bill.id}`, { headers: bearer(token) }),
        )
      ).status,
    ).toBe(200);
  });
});

describe('Participant 路由不需要 JWT', () => {
  it('凭 share_token 读账单、写 claims 无需登录', async () => {
    const app = makeApp();
    const { token } = await login(app, 'tok-alice');
    const bill = await j<Obj & { shareToken: string }>(
      await app.request(
        post('/bills', { title: 'A 的', taxCountry: 'DE' }, bearer(token)),
      ),
    );
    const item = await j<Obj>(
      await app.request(
        post(
          `/bills/${bill.id}/items`,
          { name: 'Eier', qtyMilli: 2000, unitPriceMilli: 2790, taxClass: 'B' },
          bearer(token),
        ),
      ),
    );
    const fam = await j<Obj>(
      await app.request(
        post(`/bills/${bill.id}/families`, { name: 'Rio家' }, bearer(token)),
      ),
    );

    // 无任何 Authorization:
    expect(
      (await app.request(`http://x/share/${bill.shareToken}`)).status,
    ).toBe(200);
    const claimRes = await app.request(
      new Request(`http://x/share/${bill.shareToken}/claims`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          familyId: fam.id,
          portion: 1,
        }),
      }),
    );
    expect(claimRes.status).toBe(200);
  });
});
