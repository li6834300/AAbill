# 008: Owner 登录(JWT 鉴权)

日期:2026-07-08 · 分支:m8-auth

## 验收标准(补最大安全洞)

- `/bills/*` 需 Owner JWT;账单归属 owner,跨 owner 访问不可见
- `/share/*` 始终免登录(Participant)
- OAuth 校验抽象,Google/Apple 待 client id;本地用 dev 登录

## 红 → 绿

- auth.test(10 例)先行:JWT 往返/拒伪造、verifier 选择、session 换发、Owner 401/归属 404、
  Participant 免登录。实现 jwt/verifier/session/requireOwner/ownerId 后全绿。
- 既有 4 个测试文件(bills/parse/settlement/share/pg-repo)因鉴权全红 → 抽出 test/helpers.ts
  统一带 JWT,逐个补齐。最终 server 50 全绿。

## 被自己抓到的两个问题

1. **hono/jwt 需显式 alg**:`verify` 不带 `'HS256'` 抛 `JwtAlgorithmRequired`。往返测试先红,
   调试后给 sign/verify 都补上算法 —— 又一次"别凭记忆用库 API"。
2. **预览时炸出既有 bug(非鉴权引入)**:登录后直接落在空账单详情页,settlement 500
   ——`core.settle` 对空家庭抛错。M5 起详情页每次加载都拉 settlement,但此前的预览总是先加了
   家庭/条目才看,空态没触发。按铁律先写复现测试(期望 409)再修 settlement/lock 的未就绪守卫。

## 为什么用 404 而非 403

非属主访问返回 404 而不是 403:403 等于承认"这个 id 存在但不是你的",泄露存在性。
404 让越权者无法区分"不存在"与"不是你的"。auth.test 对此专门断言。

## 学到的

加一道鉴权中间件,炸的是所有既有测试 —— 但因为接口早已注入(repo/verifier 都走 deps),
retrofit 是机械的:抽一个带 token 的请求构造器,替换各文件的 helper 即可,被测行为一行没改。
分层与依赖注入的红利在"改横切关注点"时才真正兑现。
