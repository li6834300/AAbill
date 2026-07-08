# ADR 0007: Owner JWT 鉴权与账单归属

日期:2026-07-08 · 状态:已接受

## 背景

此前 `/bills/*` 无鉴权:持 bill.id 任何人都能读写账单 —— 目前最大的安全洞(ADR 0004 待接线清单)。
PRD §5.3:Owner 靠 JWT,Participant 靠 share_token。

## 决策

1. **JWT**(auth/jwt.ts):用 `hono/jwt`(免新依赖)HS256 签发/校验,载荷 `{sub, email, exp}`,30 天。
   密钥 `JWT_SECRET`(Heroku config var);缺失时用不安全默认并告警。
2. **OAuth 校验抽象**(auth/verifier.ts):`IdentityVerifier.verify(provider, idToken) → {sub, email}`。
   - `mock`:测试用
   - `dev`:idToken 当邮箱、sub=邮箱哈希 —— **仅 `ALLOW_DEV_LOGIN=1` 启用**,生产绝不可开
   - `unconfigured`:Google/Apple 待 client id,当前抛错(不假装能用)
3. **路由**:
   - `POST /auth/session`:验 id token → 签发应用 JWT
   - `requireOwner` 中间件守 `/bills` 与 `/bills/*`:无有效 JWT → 401
   - 账单带 `ownerId`(= JWT sub);列表按 owner 过滤;`loadBill` 对非属主一律当不存在 → **404**
     (不用 403,避免泄露"这个 id 存在但不是你的")
   - `/share/*` 不经 requireOwner —— Participant 始终免登录(核心不变量,auth.test 专门断言)
4. **数据**:migrations 已有 `owner_id`;pg-repo 持久化。

## 连带修的 bug

详情页每次加载拉 settlement;新建账单尚无家庭,`core.settle` 抛"家庭列表不能为空"→ 500。
settlement/lock 增加"未就绪"守卫:无家庭或无条目 → 409(先写复现测试再修)。

## 客户端

mobile:`lib/auth.ts` 存 token(web 持久化 localStorage),owner 请求自动带 `Authorization`;
开发登录页输入邮箱即登录。Participant 认领页不碰 token。

## 部署前仍待接线

Google/Apple 真实 verifier(需 client id,走 JWKS 验签、校验 audience);当前 `ALLOW_DEV_LOGIN`
仅供本地。生产 Heroku:设 `JWT_SECRET`、**不设** `ALLOW_DEV_LOGIN`。
