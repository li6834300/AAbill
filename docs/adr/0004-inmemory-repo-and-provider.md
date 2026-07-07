# ADR 0004: 内存仓储过渡 + AI provider 按环境切换

日期:2026-07-07 · 状态:已接受(内存仓储为**过渡态**,部署前必须替换)

## 背景

M2/M3 要打通「识别 → 校对 → 分账页」闭环,但两项外部依赖的凭据都不在开发环境:
Neon Postgres 连接串、OpenAI API key(均由 Owner 掌握,见 .env.example)。

## 决策

1. **仓储接口 `BillRepo`**(server/src/repo.ts):路由只依赖接口;当前唯一实现是
   `createInMemoryRepo()`(进程内 Map,重启即丢)。Postgres 实现 + migrations 在
   部署期接线,届时补 API 集成测试(Vitest + 本地 Docker Postgres,按 PRD §6.1)。
2. **识别接口 `ReceiptParser`**(server/src/ai/provider.ts):
   - `createMockParser()`:确定性输出(Metro 夹具三行缩影),测试与本地默认;
   - `createOpenAIParser()`:fetch 直调 chat/completions,vision + structured outputs
     (`json_schema` 由 zod 4 的 `z.toJSONSchema(ParsedReceiptSchema)` 生成),不引 SDK;
   - `selectParser(env)`:有 `OPENAI_API_KEY` 且 `AI_PROVIDER!== 'mock'` 时走 OpenAI。
3. AI 输出保持发票原貌(十进制字符串),在 parse 路由边界统一转整数分/千分位(ADR 0003);
   **印刷行总额(Wert)必读**,存 `printedLineNetCents`,validate 可 0 差额对账。

## 部署前待接线清单

- [ ] Postgres 仓储实现 + migrations + Docker 集成测试(替换内存实现)
- [ ] OpenAI 真 key 冒烟:确认 strict json_schema 与 zod 生成的 schema 兼容
- [ ] Cloudinary 图片存储(当前 parse 接收 base64 直传,不落盘)
- [ ] Owner JWT 鉴权(当前路由无鉴权,仅限本地)

## 代价与缓解

- 内存数据重启即丢 → 仅本地演示用;PR 描述与 README 需注明。
- OpenAI 实现未经真实调用验证 → 已用 stub fetch 锁住请求构造与错误路径,真 key 到位后跑冒烟。
