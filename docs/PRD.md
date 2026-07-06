# AAbill — 产品规划与 TDD 开发流程

> 版本 v0.2 · 2026-07-06 · Owner: Zhien
> 目标:把「超市合买 → 发票识别 → 分账 → 各自认领 → AA 汇总」流程产品化,同时作为 AI-assisted TDD 全流程的练手项目。

---

## 1. 产品概述

**一句话**:拍一张超市发票,AI 识别所有商品,生成可分享的分账页面,同行的朋友免登录勾选自己买的东西,系统自动算出每家该付多少。

**形态**:跨平台 App(Expo / React Native),同一套代码同时输出 iOS、Android 和 Web。Owner 用手机 App;被分享的朋友通过链接在浏览器打开同一套 UI 的 Web 版,**无需安装、无需注册**。

**不做**(第一版):支付/转账功能、朋友端拍照识别(PRO 功能,放二期)、多币种、荷兰/德国以外的税制。

## 2. 角色

| 角色 | 说明 | 入口 |
| --- | --- | --- |
| Owner | 发起人,上传发票、管理账单、最终确认 | App(可注册,保存历史账单) |
| Participant | 一起买东西的朋友,认领自己的商品 | 分享链接,免登录,输入/选择自己的家庭名即可 |

## 3. 用户故事(完善版)

### Epic A — 发票识别
- A1 作为 Owner,我拍照或上传发票(PDF/图片),AI(OpenAI API)识别出每个商品的名称、数量/重量、单价、折后价、税类(A 19% / B 7%)。
- A2 作为 Owner,我能看到识别结果列表,并手动修正错误条目(改名、改价、增删行)。识别永远可能出错,**人工校对是流程的一部分,不是兜底**。
- A3 作为 Owner,商品名自动附中文翻译,方便中国朋友认领。
- A4 系统用发票上的合计金额校验:所有条目之和 ≈ 发票总额,不匹配时高亮提示差额,引导我找出漏识别/错识别的行。

### Epic B — 账单与分账页
- B1 作为 Owner,识别确认后自动生成一个账单页面,列出全部商品(名称、中文名、数量、含税单价、含税总价)。
- B2 作为 Owner,我添加参与分账的家庭(如 Rio家、华东家、老唐家、Yuxi家、荣荣家),**用真实名字而非 ABCDE**。
- B3 作为 Owner,我可以把某个商品标记为「均摊」(如鸡蛋),费用由所有家庭平分;也可以把一个商品按数量拆给多家。
- B4 折扣不单列一行,而是**按比例分摊回每个商品的价格**(Metro 的 INT KD 价已含折扣;其他超市的整单折扣按净额比例摊入各商品)。

### Epic C — 分享与认领
- C1 作为 Owner,我生成一个分享链接(可发微信/WhatsApp),朋友点开即见账单。
- C2 作为 Participant,我免登录进入,选择自己的家庭名,勾选自己买的商品;已被别家认领的商品有标识,同一商品可多家共享(按份数或均分)。
- C3 认领是实时同步的:多人同时勾选,大家都能看到最新状态。
- C4 作为 Owner,我能看到认领进度(哪些商品还没人认领)。

### Epic D — 确认与汇总
- D1 作为 Owner,全部认领完成后我做最终确认,账单锁定,Participant 不能再改。
- D2 系统生成 AA 汇总:每家的净额、含税总额、明细;汇总之和必须精确等于发票总额(分摊尾差处理规则见 §5)。
- D3 汇总结果可一键复制为文本/图片发到群里。

### Epic E — 历史账单
- E1 作为 Owner,我能看到自己创建过的所有账单及状态(识别中/认领中/已锁定)。

### 二期(不在 MVP)
- PRO:Participant 拍自己小票,AI 预选其买的商品,识别不确定的高亮让其手动确认。
- 发起付款(嵌入 iDEAL/Tikkie 或深链)。

## 4. 核心业务规则(来自现有发票整理流程)

1. 税类按发票所在国:荷兰 → 21% / 9% VAT;德国(如 Metro)→ A 19% / B 7%。账单需标注国家/税制,税率作为配置而非硬编码。
2. Metro 发票:以 INT KD PREIS(折后净价)为准,**不重复打折**;含 M(手输)和 *(折扣)行。
3. 计算:净额 = 数量/重量 × 折后净单价;含税 = 净额 × (1+VAT)。
4. 整单折扣(非 Metro 场景):按各商品净额比例分摊进商品价格,不单独成行。
5. 均摊商品:标记后由全部家庭平分(如鸡蛋)。
6. 校验:Σ条目净额 = 发票净额,ΣVAT 分税类核对,Σ含税 = 发票总额。
7. 尾差:分摊后按分转整,尾差(±0.01€ 级别)按最大余数法分配,保证汇总恰好等于发票总额。

---

## 5. 技术架构

### 5.1 选型

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 客户端 | **Expo (React Native + TypeScript) + Expo Router** | 一套代码出 iOS/Android/Web;朋友的免登录链接直接由同一代码库的 Web 版承接,不用维护两个前端 |
| 后端 API | **Node + Hono(TypeScript)**,部署在 **Heroku**(复用 overstep 的 $5/月方案) | 自己写 API 层,鉴权/路由/中间件都是可测试对象,TDD 练习价值比 BaaS 高 |
| 数据库 | **Neon Postgres 免费层**(已核实:Heroku 账户无 Postgres 附加组件,加装需另付 ~$5/月) | 零新增成本;Heroku Eco 订阅按账户计,AAbill 新 app 共用现有 dyno 时数 |
| 图片存储 | **Cloudinary 免费层** | Heroku 文件系统是临时的,重启即丢,不能存发票图片 |
| 实时同步 | MVP 用 **5 秒轮询**;二期升级 WebSocket(Socket.io,Heroku 支持) | 轮询实现和测试都简单,认领勾选场景延迟 5 秒完全可接受 |
| AI 识别 | **OpenAI API**(gpt-4o 系列 vision + structured outputs 强制 JSON schema);代码层做 provider 抽象,DeepSeek V4 作为可切换备选 | DeepSeek V4 虽已支持多模态且更便宜,但无严格 schema 约束的结构化输出;我们量小,可靠性优先。月成本上限 $10(OpenAI 后台设硬限额 + 服务端记录用量) |
| 密钥安全 | OpenAI/DeepSeek 调用只发生在服务端,API key 不落客户端 | |
| 登录 | Owner 用 **Google / Apple 登录**(expo-auth-session → 服务端校验 ID token → 自签 JWT);Participant 免登录 | "通常 App 的方式";注意 App Store 规则:提供第三方登录就必须同时提供 Apple 登录 |
| 业务核心 | **独立纯 TypeScript 包 `packages/core`**(零依赖):税额、折扣分摊、均摊、尾差、校验 | 纯函数 = TDD 的主战场,前后端共用同一份逻辑 |
| 部署 | App 用 EAS Build(先跑 Expo Go/开发版即可,不急着上架);Web 版部署 Vercel;API + DB 在 Heroku | 个人项目免上架审核之痛 |

### 5.2 仓库结构(= 本地 AAbill 文件夹 = GitHub 仓库根)

设计目标:GitHub 上不只展示代码,还展示 **TDD 实践过程** 和 **AI 协作的 md context**。

```
AAbill/
├── README.md                 # 项目门面:是什么、架构图、指向 TDD 实践的导览
├── CLAUDE.md                 # AI 协作上下文:开发铁律、TDD 规矩、常用命令(md context 展示点)
├── docs/                     # 给人看的文档,GitHub 直接渲染
│   ├── PRD.md                # 本规划文档迁移至此,持续更新
│   ├── architecture.md       # 架构与数据模型
│   ├── tdd-workflow.md       # TDD × AI 协作流程说明(展示重点)
│   ├── adr/                  # 架构决策记录(如 0001-heroku-over-supabase.md)
│   └── tdd-log/              # 每个功能一篇红-绿-重构日志(展示重点)
├── apps/
│   └── mobile/               # Expo App(iOS/Android/Web 同源)
├── packages/
│   ├── core/                 # 纯业务逻辑:计算、分摊、校验 ← TDD 主战场
│   └── api-types/            # 前后端共享的 zod schema / 类型
├── server/                   # Node API(Hono),部署 Heroku
│   ├── src/                  # 路由、鉴权、AI provider、DB 访问
│   ├── test/                 # 集成测试(指向本地测试 Postgres)
│   ├── migrations/           # 数据库 schema 迁移
│   └── Procfile
├── .github/workflows/ci.yml
└── package.json              # npm workspaces monorepo
```

**GitHub 上展示 TDD 的四个手段**:

1. **Git 历史即证据**:严格三段式提交 `test: …`(红)→ `feat: …`(绿)→ `refactor: …`,任何人翻 commit log 就能看到红绿重构节奏。
2. **docs/tdd-log/**:每个功能一篇短日志——验收标准、先写的测试、AI 生成实现中被人工否决/修正的点。这是最能体现"AI 辅助但人主导"的部分。
3. **docs/adr/**:每个重要技术决策一页(为什么 Heroku、为什么轮询不用 WebSocket……),体现工程判断。
4. **README 徽章**:CI 状态 + 测试覆盖率(core 包目标 100%)。

CLAUDE.md 本身就是展示品:别人能看到你如何用 md 给 AI 划定规矩(如"先写测试,人审后才许写实现")。

### 5.3 数据模型(初版)

```
bills        id, owner_id, title, status(draft/claiming/locked),
             tax_country(NL/DE,决定各税类税率),
             invoice_image_url, invoice_net, invoice_vat_a, invoice_vat_b,
             invoice_gross, share_token(免登录链接凭证), created_at
families     id, bill_id, name(如"Rio家"), sort_order
items        id, bill_id, name, name_zh, qty, unit, unit_price_net,
             tax_class(A/B), is_shared(均摊), source(ai/manual), raw_text
claims       id, item_id, family_id, portion(默认1;支持按份拆分)
```

- 免登录:分享链接 = `/b/{share_token}`,token 为不可猜测随机串;API 中间件校验:持 token 可读账单 + 写 claims,其余操作需 Owner JWT。账单锁定 30 天后 token 失效。
- 同步:客户端每 5 秒轮询 claims 变更(带 updated_at 增量)。

### 5.4 关键流程

1. Owner 上传图片 → Cloudinary → 调 API `POST /bills/:id/parse` → 服务端经 provider 抽象调 OpenAI → 返回结构化条目 + 中文翻译 → 写入 items(source=ai)→ Owner 校对页。
2. 校验用 `packages/core` 的 validate():Σ净额/ΣVAT/Σ含税 对比发票合计。
3. 分享链接 → Web 版认领页 → 勾选,5 秒轮询同步。
4. Owner 锁定 → core 的 settle() 计算每家应付(含均摊、尾差分配)→ 汇总页。

---

## 6. TDD 与 AI 辅助开发流程

### 6.1 测试金字塔

| 层 | 工具 | 覆盖内容 | 占比 |
| --- | --- | --- | --- |
| 单元测试 | **Vitest** | `packages/core` 全部纯函数:税额、折扣分摊、均摊、尾差、校验。用真实 Metro 发票数据做测试夹具(fixtures) | ~70% |
| 组件测试 | Jest + **React Native Testing Library** | 认领勾选交互、校对表格编辑、汇总展示 | ~20% |
| 集成/E2E | **Maestro**(移动端 YAML 流程)+ API 集成测试(Vitest + 本地 Docker Postgres,测路由/鉴权/share_token 权限) | 关键路径:上传→识别→分享→认领→锁定→汇总 | ~10% |
| AI 输出评测 | 固定一组真实发票样本,对 parse-receipt 的输出跑快照+字段断言(允许模糊匹配),防 prompt 回归 | 单独 job |

### 6.2 红-绿-重构 × AI 协作节奏

每个功能严格走以下循环,**你是 PM/审核者,AI 是结对程序员**:

1. **写验收标准**(你):从 §3 的用户故事挑一条,用 Given/When/Then 写清楚。
2. **红**:让 AI 先只写测试(不写实现)。core 的金额计算:你审查测试是否真的表达了需求(测试即规格)后才许实现;其余模块 AI 可连续执行,事后抽查。跑测试,确认失败。
3. **绿**:让 AI 写最小实现,只求测试通过。
4. **重构**:测试保持绿的前提下整理代码;AI 提重构建议,你决定采纳与否。
5. **提交**:一个循环一个 commit(`test: …` → `feat: …` → `refactor: …`),PR 触发 CI。

规矩:❌ 不允许 AI 一次性生成"实现+测试"(测试会迁就实现);❌ 不许通过改测试变绿(core 测试改动=改规格,须人批准);✅ 实现阶段红了 AI 自主修到绿;✅ 每个 bug 先写复现测试再修。

### 6.3 CI(GitHub Actions)

push/PR 触发:lint(ESLint + Prettier)→ typecheck → Vitest 单测 → RNTL 组件测试 → Maestro 冒烟(main 分支)。全绿才能合并。

### 6.4 里程碑

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M0 脚手架 | Monorepo + Expo + Hono server + 本地 Postgres(Docker)+ Heroku 部署通 + CI 跑通一条 dummy 测试 | 空跑的绿色流水线 |
| M1 核心逻辑 | **纯 TDD** 完成 core:税额→折扣分摊→均摊→尾差→validate/settle,用历史真实发票当 fixtures | 100% 覆盖的 core 包 |
| M2 识别 | AI provider 抽象 + OpenAI structured outputs + 上传/解析 API + 校对编辑页 | 上传→可校对的条目列表 |
| M3 分账页 | 账单/家庭/商品页,均摊标记,校验提示 | Owner 端闭环 |
| M4 分享认领 | share_token 权限中间件 + Web 认领页 + 轮询同步 | 朋友可免登录勾选 |
| M5 汇总锁定 | settle 接入 UI、锁定、复制汇总、历史列表 | MVP 完成,下次采购实战 |

M1 放最前是刻意的:业务规则是这个产品的灵魂,而且纯函数 TDD 最容易建立节奏感。

---

## 7. 已拍板决策(2026-07-06)

1. **App 名字**:AAbill。
2. 登录:Owner 用 Google/Apple 登录 + 自签 JWT;Participant 免登录链接。
3. AI:OpenAI gpt-4o 系列,月成本上限 $10(OpenAI 后台硬限额 + 服务端用量记录);provider 抽象,DeepSeek V4 为备选。
4. 中文翻译:识别时由同一次 OpenAI 调用一并输出。
5. 分享链接:账单锁定 30 天后失效。
6. 后端:Heroku(复用 overstep 的 $5/月 Eco 订阅)+ Node/Hono API;仓库放本地 AAbill 文件夹并发布 GitHub。
7. 数据库:**Neon Postgres 免费层**。2026-07-06 核实 Heroku 账户 Datastores 为空(无任何 Postgres 附加组件),加装 Essential-0 需另付 ~$5/月;Neon 免费层对个人使用足够。Eco dyno 会休眠(闲置 30 分钟),首次访问冷启动约 10 秒,个人场景可接受。
8. 仓库骨架已按 §5.2 创建并完成首次 commit(2026-07-06):README、CLAUDE.md、docs(PRD/architecture/tdd-workflow/adr×2/tdd-log)、目录结构、git init。

