import type { ReceiptParser } from '../src/ai/provider.js';
import { createApp } from '../src/app.js';
import { createMockVerifier } from '../src/auth/verifier.js';
import { createCaptureMailer, type CaptureMailer } from '../src/mail/mailer.js';
import { createInMemoryRepo, type BillRepo } from '../src/repo.js';
import { createInMemoryUserRepo, type UserRepo } from '../src/users.js';
import type { ClaimSuggester } from '../src/ai/suggester.js';
import type { FileStore } from '../src/storage/file-store.js';

// Owner 鉴权接入后,所有 /bills 路由需 JWT。本 helper 提供带 mock verifier 的 app 与
// 便捷的换发/带鉴权请求,让既有测试聚焦各自被测行为,不重复登录样板。

export const TEST_SECRET = 'test-secret';

const MOCK_IDENTITIES = {
  'tok-alice': { sub: 'alice', email: 'alice@example.com' },
  'tok-bob': { sub: 'bob', email: 'bob@example.com' },
};

export function testApp(
  deps: {
    repo?: BillRepo;
    parser?: ReceiptParser;
    fileStore?: FileStore;
    suggester?: ClaimSuggester;
  } = {},
) {
  return createApp({
    repo: deps.repo ?? createInMemoryRepo(),
    ...(deps.parser ? { parser: deps.parser } : {}),
    ...(deps.fileStore ? { fileStore: deps.fileStore } : {}),
    ...(deps.suggester ? { suggester: deps.suggester } : {}),
    jwtSecret: TEST_SECRET,
    verifier: createMockVerifier(MOCK_IDENTITIES),
  });
}

type App = ReturnType<typeof testApp>;

/**
 * 走完整的「注册 → 收信 → 点链接验证」拿到可用 JWT。
 * 邮箱验证接入后,注册本身不再签发 token(未验证不得登录),
 * 所以需要登录态的测试都得过这一道。
 */
export async function signUpVerified(
  app: App,
  mailer: CaptureMailer,
  email = 'user@example.com',
  password = 'goodpassword',
): Promise<string> {
  const body = (b: unknown) =>
    new Request('http://x/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
    });
  await app.request(body({ email, password }));
  const text = mailer.sent.at(-1)?.text ?? '';
  const m = /token=([0-9a-f]{64})/.exec(text);
  if (!m) throw new Error(`验证信里没有令牌: ${text}`);
  const res = await app.request(
    new Request('http://x/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: m[1] }),
    }),
  );
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error(`验证失败: ${JSON.stringify(data)}`);
  return data.token;
}

export async function ownerToken(
  app: App,
  idToken = 'tok-alice',
): Promise<string> {
  const res = await app.request(
    new Request('http://x/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'mock', idToken }),
    }),
  );
  return ((await res.json()) as { token: string }).token;
}
