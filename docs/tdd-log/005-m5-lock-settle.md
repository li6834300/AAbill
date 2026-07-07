# 005: M5 —— 锁定 + AA 汇总 + 复制文本

日期:2026-07-07 · 分支:m4-claims

## 验收标准(PRD D1-D3 / M5)

- 全部认领完成(均摊不算未认领)才可锁定;锁定幂等;锁后 Participant claims 与 Owner
  改条目/家庭/合计/重识别一律 423,settlement 仍可读
- GET settlement 调 core.settle:每家净额/税额/含税,Σ家庭 gross **精确等于**账单 gross
- 汇总一键复制为文本(D3;图片导出二期)
- 历史列表:账单列表已带 status(draft/locked),E1 简版达成

## 红 → 绿

- server 5 例:settlement 期望值直接复用 core settle 测试的手算基准(甲 655/乙 638/丙 199,
  总 1492)——server 只做映射,不重算,两层测试互为印证
- mobile:SettlementTable + buildSummaryText 快照式断言(可发群里的文本格式是产品的一部分)
- 锁定守卫用 Hono 中间件统一实现(`/bills/:id/*` 的写方法拦截,`/lock` 除外保持幂等),
  避免在每个 handler 里散落 if

## 预览实测(全流程)

建单 → mock 识别 3 行 → 鸡蛋标均摊 → 两家分别认领(UI + API 并发)→ 轮询同步 →
汇总 Rio 5.35 / 老唐 22.92,合计 28.27 与发票总额精确一致(B 类税尾差 1 分按最大余数给了老唐家)→
锁定 → 认领页出现橙色锁定横幅、控件消失。

## 学到的

结算金额的正确性由 core 的 47 个测试背书,server/UI 层的测试只锁「接线正确」——
分层测试让「谁为哪个断言负责」非常清晰,改 UI 不用担心碰坏钱的计算。
