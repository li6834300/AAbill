import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import { selectParser } from './ai/provider.js';
import { selectVerifier } from './auth/verifier.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { createPostgresRepo } from './db/pg-repo.js';
import { createInMemoryRepo, type BillRepo } from './repo.js';

const port = Number(process.env.PORT ?? 3000);
const { kind, parser } = selectParser(process.env);
const verifier = selectVerifier(process.env);

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('⚠️ 未设置 JWT_SECRET,使用不安全的默认值(生产必须配置)');
}

async function makeRepo(): Promise<{ repoKind: string; repo: BillRepo }> {
  const url = process.env.DATABASE_URL;
  if (!url)
    return { repoKind: 'in-memory(重启即丢)', repo: createInMemoryRepo() };
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: url,
    // Neon 等托管 PG 需要 TLS;本地不需要
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await migrate(pool);
  return { repoKind: 'postgres', repo: createPostgresRepo(pool) };
}

const { repoKind, repo } = await makeRepo();
const app = createApp({
  repo,
  parser,
  verifier,
  ...(jwtSecret ? { jwtSecret } : {}),
});
const authKind =
  process.env.ALLOW_DEV_LOGIN === '1' ? 'dev-login' : 'oauth(需 client id)';

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `AAbill server listening on :${info.port}` +
      `(AI: ${kind} / DB: ${repoKind} / Auth: ${authKind})`,
  );
});
