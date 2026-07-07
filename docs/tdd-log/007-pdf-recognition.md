# 007: PDF 识别(修正 image-only 的疏漏)

日期:2026-07-07 · 分支:m7-pdf

## 起因(人指出的缺口)

PM 指出:我们的发票多是 PDF,不只是图片 —— app 支持吗?查 PRD §3 A1 确实写了「PDF/图片」,
是我首版把识别做窄成了 image-only。这是需求回读没到位。

## 验收标准

- provider 与 parse 路由接受图片**和** PDF;不支持的类型 400
- OpenAI 用能收 PDF 的 API(查证:chat/completions 自 2025-09 起不收文件,必须 Responses API)
- mobile 能选 PDF

## 红 → 绿

- 改写 provider 测试为 Responses API 形状 + 新增 PDF 用例(input_file);parse 测试加 PDF 透传 +
  非法 mimeType 400。7 红。
- 实现:openai.ts 迁 /v1/responses;ParseInput 泛化 fileBase64;路由 mimeType 校验;
  mobile pick-invoice 跨端读 base64。39 server 测试全绿。

## 两个真实世界的坑

1. **OpenAI 换了 API 边界**:凭记忆写会用错(chat/completions 文件输入已下线)。用 WebFetch 查了
   官方文档确认 Responses API 的确切字段,再动手 —— 调付费 API 的代码不该猜。
2. **真 key 冒烟先被自己的测试脚本坑**:手写 .env 解析没剥行内注释,把 key 后的中文注释并进
   authorization header,undici 报 ByteString 错(非 latin1)。换 Node `--env-file` 后拿到干净的
   429 insufficient_quota —— 证明请求结构对、账户缺额度。教训:.env 行内注释要么别写,要么用正规解析器。

## 学到的

「需求回读」和「外部 API 版本核对」是 AI 最容易想当然的两处。前者靠人把关(这次就是 PM 抓的),
后者靠查文档而非记忆。两道关都过了,实现反而是最快的部分。
