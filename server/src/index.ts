import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import { selectParser } from './ai/provider.js';
import { selectSuggester } from './ai/suggester.js';
import { selectVerifier } from './auth/verifier.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { createPostgresRepo } from './db/pg-repo.js';
import { createInMemoryRepo, type BillRepo } from './repo.js';
import { createInMemoryUserRepo, type UserRepo } from './users.js';
import { createPostgresUserRepo } from './db/pg-user-repo.js';
import { selectFileStore } from './storage/file-store.js';
import { selectMailer } from './mail/mailer.js';

const port = Number(process.env.PORT ?? 3000);
const { kind, parser } = selectParser(process.env);
const { suggester } = selectSuggester(process.env);
const verifier = selectVerifier(process.env);
const { kind: storeKind, store: fileStore } = selectFileStore(process.env);
// 配了 RESEND_API_KEY 却漏了 MAIL_FROM 会在此直接抛错 —— 宁可启动失败,
// 也好过每个注册用户都收不到验证信却毫无察觉。
const { kind: mailKind, mailer } = selectMailer(process.env);
const appBaseUrl = process.env.APP_BASE_URL?.trim();

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('⚠️ 未设置 JWT_SECRET,使用不安全的默认值(生产必须配置)');
}

async function makeRepo(): Promise<{
  repoKind: string;
  repo: BillRepo;
  userRepo: UserRepo;
}> {
  const url = process.env.DATABASE_URL;
  if (!url)
    return {
      repoKind: 'in-memory(重启即丢)',
      repo: createInMemoryRepo(),
      userRepo: createInMemoryUserRepo(),
    };
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: url,
    // Neon 等托管 PG 需要 TLS;本地不需要
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await migrate(pool);
  return {
    repoKind: 'postgres',
    repo: createPostgresRepo(pool),
    userRepo: createPostgresUserRepo(pool),
  };
}

const { repoKind, repo, userRepo } = await makeRepo();
// 没有真实发信通道(mailKind === 'console')时不强制验证:
// 验证信只会进服务器日志,用户永远收不到,要求验证等于把注册通道关死。
// 配上 RESEND_API_KEY 后验证自动生效,无需改代码。
const verificationRequired = mailKind !== 'console';

const app = createApp({
  repo,
  userRepo,
  mailer,
  verificationRequired,
  ...(appBaseUrl ? { appBaseUrl } : {}),
  parser,
  verifier,
  fileStore,
  suggester,
  ...(jwtSecret ? { jwtSecret } : {}),
});
const authKind =
  process.env.ALLOW_DEV_LOGIN === '1' ? 'dev-login' : 'oauth(需 client id)';

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `AAbill server listening on :${info.port}` +
      `(AI: ${kind} / DB: ${repoKind} / Auth: ${authKind} / Store: ${storeKind}` +
      ` / Mail: ${mailKind} / 邮箱验证: ${verificationRequired ? '开' : '关'})`,
  );
});
