# ADR 0006: 识别走 OpenAI Responses API,支持图片与 PDF

日期:2026-07-07 · 状态:已接受

## 背景

PRD §3 A1 明确「拍照或上传发票(PDF/图片)」。首版 provider 只处理图片(chat/completions +
`image_url`),遗漏了 PDF —— 而真实发票(如 Metro)多为 PDF。此外 OpenAI 自 **2025-09-12 起
chat/completions 不再接受文件输入**,PDF 必须走 Responses API。

## 决策

1. **OpenAI provider 迁到 Responses API**(`POST /v1/responses`):
   - 图片 → `{ type: 'input_image', image_url: 'data:…' }`
   - PDF → `{ type: 'input_file', filename, file_data: 'data:application/pdf;base64,…' }`
   - 结构化输出 → `text.format = { type: 'json_schema', strict, schema }`(zod 生成)
   - 读取:`output[].content[]` 中 `type === 'output_text'` 的 text
   - 单文件 ≤ 50MB;gpt-4o 及以上同时具备文本抽取与页面图像理解
2. **ParseInput 泛化**:`imageBase64` → `fileBase64`;parse 路由 `mimeType` 限 `image/*` 或
   `application/pdf`,其余 400。
3. **mobile**:`pick-invoice.ts` 用 expo-document-picker 选图片或 PDF,跨 web(FileReader)/
   原生(expo-file-system)读 base64。
4. **mock provider 不变**:仍返回夹具,本地与测试零依赖。

## 验证

- 单测锁住请求形状(URL / input_image / input_file / json_schema)与错误路径。
- 真 key 冒烟(手写最小 PDF):请求通过 OpenAI 鉴权并进入计费闸门,返回 429 `insufficient_quota`
  —— 证明端点、鉴权、请求结构正确,仅账户缺额度(需充值)。格式错误会是 400,不是 429。

## 未做(另行处理)

- **发票文件存储(Cloudinary)**:当前 base64 直传给 AI、不落盘。Cloudinary 支持 PDF(存储 +
  页面栅格化),但属于「保存原始发票供回看」的独立任务,与识别解耦。
- DeepSeek 备选 provider:接口已抽象,待需要时加。
