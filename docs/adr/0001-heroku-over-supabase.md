# ADR 0001: 后端用 Heroku 自建 API,而非 Supabase

日期:2026-07-06 · 状态:已接受

## 背景

初版方案是 Supabase(Postgres + Storage + Realtime + Edge Functions + RLS),免运维且免费额度够用。但 Owner 已为 overstep 项目付费 Heroku($5/月),可复用。

## 决策

Node + Hono API 部署 Heroku,Postgres 同在 Heroku(或 Neon 免费层,视现有方案是否含 Postgres 附加组件)。放弃 Supabase。

## 理由

1. 复用已付费资源,新增成本≈0。
2. **TDD 练习价值更高**:自己写鉴权中间件、share_token 权限、路由——这些在 Supabase 里是 RLS 配置,不可单元测试;在自建 API 里是普通代码,可测。
3. 项目本身是学习项目,多写一层可测试的后端符合目标。

## 代价与缓解

| 失去 | 缓解 |
| --- | --- |
| Supabase Realtime | MVP 用 5 秒轮询(见 ADR 0003 计划),二期 Socket.io |
| Supabase Storage | Cloudinary 免费层(Heroku 文件系统是临时的) |
| Supabase Auth | Google/Apple 登录 + 自签 JWT,expo-auth-session |
| RLS 兜底 | API 中间件统一鉴权,用集成测试覆盖 |
