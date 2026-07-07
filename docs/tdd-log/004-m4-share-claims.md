# 004: M4 —— share_token 分享 + 免登录认领 + 轮询

日期:2026-07-07 · 分支:m4-claims

## 验收标准(PRD C1-C4 / §5.3)

- 分享链接 `/b/{share_token}`,token 不可猜测;持 token 只能读账单、写 claims
- 认领 upsert:同 (item, family) 更新份数,portion=0 取消;同一商品可多家共享
- 均摊商品不可认领(与 claims 互斥,409);锁定后写入 423
- Owner 删条目/删家庭时级联清除相关 claims(否则结算会引用幽灵数据)
- 认领状态实时可见:MVP 每 5 秒全量轮询

## 红 → 绿

- server 8 例(share 读取/upsert/多家共享/互斥/级联/404/400)→ 路由实现,26 全绿
- mobile:ClaimItemRow 6 例(认领/份数步进/取消/他家标识/均摊只读/锁定只读)→ 组件实现
- 预览实测:两个"家庭"并发认领(一个走 UI、一个走 API),5 秒内互相可见

## 与 PRD 的偏离(记录)

- §5.3 说轮询"带 updated_at 增量"。MVP 改为**全量拉取**:账单只有几十行,增量省不了几个字节,
  却要处理删除 tombstone;等真有性能诉求再上增量/WS(二期本来就计划 Socket.io)
- Owner 路由仍无 JWT(M4 只做了 Participant 侧的 token 门):持 bill.id 即可写账单,
  部署前必须补 Owner 鉴权(已在 ADR 0004 待接线清单)

## 学到的

「均摊与认领互斥」这条规则在 core(settle 抛错)、server(409)、UI(不渲染认领按钮)三层各自表达
——测试先行让三层口径在写实现前就对齐了。
