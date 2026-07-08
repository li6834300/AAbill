import type { ReceiptParser } from '../src/ai/provider.js';
import { createApp } from '../src/app.js';
import { createMockVerifier } from '../src/auth/verifier.js';
import { createInMemoryRepo, type BillRepo } from '../src/repo.js';

// Owner 鉴权接入后,所有 /bills 路由需 JWT。本 helper 提供带 mock verifier 的 app 与
// 便捷的换发/带鉴权请求,让既有测试聚焦各自被测行为,不重复登录样板。

export const TEST_SECRET = 'test-secret';

const MOCK_IDENTITIES = {
  'tok-alice': { sub: 'alice', email: 'alice@example.com' },
  'tok-bob': { sub: 'bob', email: 'bob@example.com' },
};

export function testApp(
  deps: { repo?: BillRepo; parser?: ReceiptParser } = {},
) {
  return createApp({
    repo: deps.repo ?? createInMemoryRepo(),
    ...(deps.parser ? { parser: deps.parser } : {}),
    jwtSecret: TEST_SECRET,
    verifier: createMockVerifier(MOCK_IDENTITIES),
  });
}

type App = ReturnType<typeof testApp>;

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
