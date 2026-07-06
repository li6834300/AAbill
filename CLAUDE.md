# CLAUDE.md — AI 协作规矩

本项目是 AI-assisted TDD 实践。你(AI)是结对程序员,人是 PM 与审查者。

## TDD 铁律(不可协商)

1. **先测试,后实现**,测试与实现分开提交(先 `test:` 后 `feat:`)。
2. **人审分级**:`packages/core` 的金额计算(税额/折扣分摊/均摊/尾差/validate/settle)——测试写完必须停下等人审查,批准后才写实现;其余模块(UI、路由、脚手架)测试先行但可连续执行,人事后抽查。
3. 实现阶段测试红了:自主找问题修到绿,不必停;但**不许通过改测试来变绿**(core 的测试改动=改规格,必须人批准)。测试红着不许开新功能。
4. 每个 bug 先写复现测试,再修。
5. 实现只求让测试通过的最小代码;优化留给重构步。
6. `packages/core` 覆盖率目标 100%,不允许为凑覆盖率写无断言测试。

## 提交规范

每个红-绿-重构循环 = 三个 commit:

```
test: <scope>: <行为描述>      # 红:测试先行,此时测试必须失败
feat: <scope>: <实现描述>      # 绿:最小实现,全部测试通过
refactor: <scope>: <整理描述>  # 重构:测试保持绿
```

其他:`docs:` `chore:` `fix:`(fix 必须先有 test: 复现)。

## 架构速记

- `packages/core`:零依赖纯函数。金额一律用**整数分(cent)**运算,禁止浮点欧元。税类/税率按账单国家配置(NL 21%/9%,DE 19%/7%),不许硬编码。
- `server`:Hono 路由薄壳,业务调 core;AI 调用走 provider 接口(OpenAI 实现,DeepSeek 备选),测试用 mock provider。
- 权限:Owner 靠 JWT;Participant 靠 share_token 中间件,只能读账单、写 claims。
- 尾差规则:最大余数法,各家汇总之和必须精确等于发票总额。

## 测试夹具

`packages/core/fixtures/metro-de-2026-05-16.json` 是一张真实 Metro 发票(42 行,含 KG 计重、0.1 分精度单价、A/B 两税类)。core 的测试必须用它做集成级校验:validate() 要能对上发票印刷合计(注意行级四舍五入规则,见 fixture 内 notes)。reference_family 仅作对照,不是 golden 值。

## 每个功能完成后

1. 在 `docs/tdd-log/` 写一篇短日志:验收标准、先写的测试、AI 输出被人否决/修正的点。
2. 重要技术取舍写进 `docs/adr/`。

## 常用命令

```bash
npm test                 # 全部测试
npm run test:core        # 只跑 core
npm run lint && npm run typecheck
```
