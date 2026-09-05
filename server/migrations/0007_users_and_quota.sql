-- 邮箱+密码注册登录 + AI 识别额度(免费 2 次/月,PRO 20 次/月)。
-- 此前生产无任何可用登录方式(未配 GOOGLE_CLIENT_ID 且禁开 ALLOW_DEV_LOGIN),
-- 任何人都换不到 JWT,请求 /bills 一律 401。

create table if not exists users (
  -- 认证主体 = JWT 的 sub。由邮箱推导(sha256 前 24 位),与 dev-login 同算法,
  -- 保证同一邮箱注册前后 bills.owner_id 归属不变。
  id text primary key,
  email text not null unique,
  -- scrypt 串;纯 OAuth 用户为 null
  password_hash text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null
);

-- 首次成功 AI 识别的时刻;null = 还没扣过额度。
-- 额度记在账单上而非调用次数上 —— 同一单重识别不重复扣减。
alter table bills add column if not exists quota_charged_at timestamptz;

-- 额度查询是"某 owner 自本月 1 号起扣过额度的账单数"
create index if not exists bills_owner_quota_idx
  on bills (owner_id, quota_charged_at);
