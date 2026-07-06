# AAbill

拍一张超市发票,AI 识别所有商品,生成可分享的分账页面。同行的朋友通过链接**免登录**勾选自己买的东西,系统自动算出每家该付多少 —— 解决"合买省折扣,分账靠人肉"的痛点。

> 这个仓库同时是一次 **AI-assisted Test-Driven Development** 的完整实践记录。代码之外,请看 [TDD 工作流](docs/tdd-workflow.md)、[红绿重构日志](docs/tdd-log/)、[架构决策记录](docs/adr/) 和 [CLAUDE.md](CLAUDE.md)(给 AI 的开发规矩)。

## 它做什么

1. Owner 拍照/上传发票 → OpenAI 识别商品、价格、税类,附中文翻译
2. 人工校对识别结果(校验和必须对上发票总额)
3. 生成分账页,添加参与家庭,分享链接给朋友
4. 朋友免登录勾选自己买的东西(支持共享商品、全员均摊)
5. Owner 锁定账单 → 自动生成 AA 汇总,精确到分

## 技术栈

| 层 | 选择 |
| --- | --- |
| 客户端 | Expo (React Native + TypeScript),一套代码出 iOS / Android / Web |
| 后端 API | Node + Hono,部署 Heroku |
| 数据库 | Postgres |
| AI | OpenAI gpt-4o (vision + structured outputs),provider 抽象可切换 |
| 业务核心 | `packages/core` — 零依赖纯 TS 包,税额/折扣分摊/均摊/尾差/校验 |
| 测试 | Vitest · React Native Testing Library · Maestro |

## 仓库导览

```
docs/PRD.md            产品需求与完整规划
docs/architecture.md   架构与数据模型
docs/tdd-workflow.md   TDD × AI 协作流程(本仓库的方法论)
docs/tdd-log/          每个功能的红-绿-重构日志
docs/adr/              架构决策记录
packages/core/         业务逻辑(TDD 主战场,目标覆盖率 100%)
server/                API 服务
apps/mobile/           Expo 应用
```

## TDD 如何体现在 git 历史里

每个功能严格三段式提交:

```
test: core: 整单折扣按净额比例分摊(红)
feat: core: 实现折扣分摊(绿)
refactor: core: 提取 allocate 通用函数
```

翻 commit log 即可看到每一次红-绿-重构循环。AI 负责生成,人负责规格与审查:**AI 先只写测试 → 人审测试 → AI 才许写实现**。

## 状态

🚧 M0 脚手架阶段。里程碑见 [docs/PRD.md](docs/PRD.md) §6.4。
