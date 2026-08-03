# 014 每家一个认领口令(per-family token)

## 起因

v0 的认领权限是**账单级**的:任何拿到分享链接(`/b/<shareToken>`)的人都能看到
**所有家庭**的认领明细,并且能给**任意一家**提交/修改认领 ——
`PUT /share/:token/claims/batch` 只校验 `familyId` 存在,不校验"你是不是这家"。
"我是哪家"纯靠自觉点选,没有身份隔离。用户觉得"有点怪":
"所有人都能看到并修改每一家的"。

Beta 首批目标:给每家一个 **5 位数字口令**,朋友打开账单链接后输入 owner 发给自己的
口令,才能看/改自己那家;每件商品仍显示"还剩 N 件可领"(不暴露别家是谁领的)。
owner 在详情页看到每家口令并分发。

## 已确认的设计决策(与用户逐条敲定)

- **进入方式**:分享链接 + 手输 5 位数字口令(不是每家一条专属链接)
- **隔离强度**:只见自己家 + 每件"剩余可领 N 件";看不到别家明细/别家是谁
- **口令**:5 位纯数字,账单内唯一;账单 shareToken(UUID)作前置门槛
- 只做此功能,UI 设计系统在用户的另一个分支单独进行

## 先写的测试

- `server/test/family-token.test.ts`:建家生成唯一 5 位口令;`GET /share` 降级为最小首屏
  (不泄露条目/别家/口令);`POST /share/:token/enter` 凭口令返回 scoped 视图,
  剩余量扣掉别家但**不显示是哪家**、不含任何 accessCode;凭口令认领防冒充(错→403);
  均摊互斥;超量 409;owner 能拿到所有口令。
- `apps/mobile/components/__tests__/FamilyChips.test.tsx`:owner 视角展示每家口令 + 复制。
- api-types schema 测试:口令 5 位数字、family 带 code、ClaimBatch 改用 code。

## 关键取舍

**口令由 server 从 code 解析,客户端不再传 familyId。** 这是隔离的核心:
只要认领端点还接受客户端传的 familyId,任何人都能冒充别家。改成"口令即身份"后,
冒充无从谈起 —— 口令不对直接 403。

**GET /share 从"返回整个账单"降级为最小首屏**(标题/状态/有无家庭)。
否则输入口令这道门形同虚设 —— 未输口令就能看全部。owner 仍走 `GET /bills/:id`
(需 JWT)看全量。

**剩余量可见,但不暴露是哪家。** `remaining = 可分件数 − 别家已领`。
参与者能据此避免超领(体验),却看不到别家领了什么、是谁 —— 隐私与体验的折中,
正是用户选的那档。

**拍照认领也要口令。** 一开始漏了 —— `suggest-claims` 会返回商品候选列表(名字/重量)。
不要口令的话,持分享链接者拍张照就能拿到商品清单,"只看自己"名不副实。补上 403 守卫。

**口令生成用 Web Crypto 而非 `crypto.randomInt`。** 后者是 Node 专有;
项目其余处用的都是 Web Crypto(`crypto.randomUUID`),跨运行时(Node/edge)通用。

## AI 输出被人否决/修正的点

- 契约变更(familyId→code、GET /share 降级)连带打破了 11 个既有测试。这些是**规格迁移**
  而非 bug:claim-quantity/share/settlement/auth/pg-repo/suggest 里"用 familyId 提交、
  用 GET /share 读全账单"的辅助步骤,逐一迁移到"code + owner 端点读"。迁移中把
  "均摊互斥"这条独特断言从被废弃的单条端点移到了 family-token.test。
- 废弃了单条 `PUT /share/:token/claims` 端点:前端只用 batch,留着是死代码 + 多余攻击面。

## 迁移

`server/migrations/0006_family_access_code.sql`:families 加 `access_code`;
存量 family 按账单内序号回填(10000 起,账单内唯一)。window function 不能直接用在
`UPDATE ... SET`,故用 CTE 先算序号再 join 回写。

## 安全边界

5 位数字 = 10 万组合,前置账单 shareToken(UUID v4,不可枚举)已把爆破范围收窄到单账单。
基础防爆破(同一 shareToken 连续失败节流)记为后续,beta 先不做。口令账单内唯一,
泄露只影响该家;owner 删家重加即可轮换。

## 实测

owner 建账单 + 2 家 → 详情页看到各家 5 位口令 + 复制;Rio 用口令进入 → 只见自己家、
"Others claimed 3 · 7 left"(唐家领了 3 但看不到是唐家)、无自选家庭 chips;
领 7 件(算钱 19.53 净 → 20.90 含税)提交成功;唐家用自己口令进入只见自己那份;
owner 端 claims 归属正确(唐 3 / Rio 7);错误口令 enter/claim/suggest 一律 403。
