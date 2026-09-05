-- 邮箱验证 + 每日注册名额(每天最多 10 个已验证账号)。
-- 未验证不得登录;未验证的注册不占名额(否则 10 个假邮箱就能锁死一整天)。

alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists verification_token_hash text;
alter table users add column if not exists verification_expires_at timestamptz;

-- 存量用户一律视为已验证:他们是在需要验证之前注册的,
-- 不追认会把现有用户(包括站长自己)全部锁在门外。
update users set email_verified_at = created_at where email_verified_at is null;

-- 点验证链接时按令牌哈希查用户
create unique index if not exists users_verification_token_idx
  on users (verification_token_hash)
  where verification_token_hash is not null;

-- 每日名额统计"今天验证通过的账号数"
create index if not exists users_verified_at_idx on users (email_verified_at);
