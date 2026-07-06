# ADR 0002: 发票识别用 OpenAI,DeepSeek 为备选

日期:2026-07-06 · 状态:已接受

## 背景

Owner 同时持有 OpenAI 与 DeepSeek 的付费 API。DeepSeek V4(2026)已支持多模态且价格约为 OpenAI 的 1/10。

## 决策

主用 OpenAI gpt-4o 系列(vision + **structured outputs**);代码层做 `ReceiptParser` provider 接口,DeepSeek V4 作为可切换实现,测试用 mock provider。

## 理由

1. 发票解析最怕返回不可解析的 JSON。OpenAI structured outputs 提供严格 schema 约束;DeepSeek 只有普通 JSON mode,无 schema 保证。
2. 用量极小(个人使用,每月几张发票,单张几美分),DeepSeek 的价格优势可忽略;可靠性优先。
3. 成本护栏:OpenAI 后台设 $10/月硬限额 + 服务端记录每次调用用量。

## 何时重新评估

DeepSeek 提供严格 structured outputs,或用量增长到成本可感时。届时切 provider 即可,并跑 AI 评测样本集对比准确率。
