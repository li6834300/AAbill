# ADR 0005: Postgres 仓储实现与 embedded-postgres 集成测试

日期:2026-07-07 · 状态:已接受

## 背景

ADR 0004 把仓储抽象为 `BillRepo` 接口,内存实现作过渡。部署前第一项是接真库(Neon Postgres)。
PRD §6.1 原计划「Vitest + 本地 Docker Postgres」跑集成测试,但开发机无 Docker。

## 决策

1. **数据模型**(migrations/0001_init.sql):按 PRD §5.3 规范化为 bills / families / items / claims
   四表,外键 `on delete cascade`,金额列一律整数分/千分位(ADR 0003)。`items.position` 记发票行序,
   `claims` 上 `unique(item_id, family_id)` 落实「一家对一商品至多一条认领」。
2. **迁移**(migrate.ts):`_migrations` 表记账,事务内幂等应用 `migrations/*.sql`;server 启动时自动跑。
3. **PostgresBillRepo**(pg-repo.ts):`BillRepo` 是整单粒度接口,`save` 用「事务内先删子表再重插」
   做全量同步——账单只有几十行,简单正确优先,不做差量。非法 uuid 的路径参数直接返回 undefined
   (PG 对非法 uuid 是报错而非空结果)。
4. **集成测试用 `embedded-postgres`** 取代 Docker:npm 依赖内含 PG 二进制,`beforeAll` 起进程级实例、
   跑迁移,本地与 CI 同一套,零系统安装。测试覆盖:迁移幂等、全量往返(含删行/清认领)、token 查找、
   非 uuid、真持久化(新 repo 实例读到旧数据)、路由全流程走 PG。
5. **切换**(index.ts):有 `DATABASE_URL` 走 PG(托管库自动加 TLS),否则回退内存——本地开发零依赖。

## 验证

`DATABASE_URL=… tsx src/index.ts` 对 embedded PG 实测:启动打印 `DB: postgres`,
建单→识别→条目与合计真正落库,新请求从库读回一致。

## 代价

- 「先删后插」在高并发下有竞争,但本产品是「一个 Owner 编辑一张账单」,无并发写同单场景。
- embedded-postgres 首次会下载对应平台 PG 二进制;CI 首跑略慢,之后走缓存。
