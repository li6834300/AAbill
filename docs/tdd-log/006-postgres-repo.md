# 006: 部署篇 —— Postgres 仓储

日期:2026-07-07 · 分支:m6-postgres

## 验收标准(ADR 0004 待接线清单第 1 项)

- `BillRepo` 的 Postgres 实现,与内存实现行为一致(整单往返无损)
- 规范化 schema + 幂等迁移;server 按 `DATABASE_URL` 切换,无则回退内存
- 集成测试跑真 PG,不依赖 Docker/系统安装(开发机无 Docker)

## 红 → 绿

- `test: server`(6 例):迁移幂等、create/get 全量往返(空子表 + null 合计)、save 全字段落库且
  删行/清认领精确同步、getByToken/非 uuid、真持久化(新 repo 实例见旧数据)、路由全流程走 PG
- 实现 migrations/migrate/pg-repo,37 全绿

## 技术选择:embedded-postgres 而非 Docker

PRD §6.1 写的是 Docker Postgres,但开发机无 Docker。`embedded-postgres` 把 PG 二进制作为 npm 依赖,
`beforeAll` 起进程级实例——本地与 CI 同一条路径,比 Docker 还省事。已在 ADR 0005 记录这次对 PRD 的偏离。

## 被自己抓到的坑

首次 live 冒烟用 `node src/index.ts` 起服务,报 `Cannot find module …/provider.js`——
`.ts` 源码里的 `.js` 导入得靠 tsx 解析,裸 node 不行。这正是 `npm start` 用 tsx 的原因;
改用 `npx tsx` 后一次通过。教训:冒烟要用真正的启动命令,别自己另拼一条。

## 学到的

接口抽象(ADR 0004)这时候兑现价值:所有路由测试无改动,换个 repo 实现直接复用同一套断言;
新加的 6 个测试只管「PG 实现符合接口契约」。
