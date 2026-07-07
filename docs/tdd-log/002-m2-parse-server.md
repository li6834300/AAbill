# 002: M2 —— api-types / server API / AI provider

日期:2026-07-07 · 分支:m2-parse(测试先行,红绿分离提交;非 core 模块按铁律可连续执行)

## 验收标准(PRD A1/A2/A4、§5.4)

- 共享 schema:金额过网络一律整数分/千分位;AI 输出保持发票十进制原貌,server 边界转换
- REST:bills CRUD、items 校对编辑(增/改/删)、families、printed totals、validate
- POST /bills/:id/parse:provider 识别 → 条目(source=ai)+ 合计入库;重复识别覆盖 AI 条目、保留手动条目
- provider 抽象:mock(确定性)/ OpenAI(structured outputs);出错 502,输入非法 400

## 红

- `test: api-types`(8 例):schema 接受/拒绝边界(0 数量、浮点分、>3 位小数、未知税类)
- `test: server 路由`(10 例):CRUD + 404/400 + validate 409(未录合计)
- `test: server provider/parse`(8 例):mock 确定性且 schema 合法;OpenAI 用 stub fetch 锁请求构造
  (URL/authorization/json_schema/data URL)与错误路径;parse 后 validate 0 差额

## 绿

- 路由薄壳,金额业务全部调 core;仓储/识别走接口注入(ADR 0004)
- OpenAI 实现 fetch 直调,schema 由 zod 生成,不引 SDK

## 被修正的点(自查)

- server 测试的 `res.json()` 在 TS 下是 unknown,首版 typecheck 挂了 → 补类型收窄辅助
  (`refactor:`,断言语义未动)。教训:每个红绿循环都要跑 typecheck,不能只看测试绿。

## 学到的

「provider 出错怎么办」在测试里先写(502 + 错误信息),实现自然就有降级路径;
mock provider 让 UI 闭环完全不依赖外部凭据。
