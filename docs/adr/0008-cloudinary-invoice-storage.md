# ADR 0008: Cloudinary 存原始发票

日期:2026-07-08 · 状态:已接受

## 背景

此前发票 base64 直接透传给 AI 就丢弃,Owner 无法回看原件。PRD 数据模型有 `invoice_image_url`。
发票是图片或 PDF(见 ADR 0006)。

## 决策

1. **存储抽象** `FileStore`(storage/file-store.ts):
   - `createCloudinaryStore`:REST 签名上传(不引 SDK),`resource_type=auto` 自动识别图片/PDF,
     存入 `aabill/` 文件夹;签名 = `sha1(排序待签参数 + api_secret)`
   - `createNullStore`:返回 null(未配置 CLOUDINARY_URL 时,本地/测试零依赖)
   - `selectFileStore(env)`:有 `CLOUDINARY_URL` → cloudinary,否则 null
2. **parse 路由**:识别时上传原图 → 记 `bill.invoiceUrl`。**存储失败不阻断识别** —— 存图是次要功能,
   Cloudinary 抖动不该让识别失败(catch + warn,invoiceUrl 保持 null)。
3. **数据**:`Bill.invoiceUrl`;migration 0002 加 `invoice_url` 列;pg-repo 持久化。
4. **mobile**:详情页展示"查看原始发票"链接。

## 验证

真实凭据冒烟:上传 PDF 成功,返回 `secure_url`(存为 image/upload,自动识别 PDF)。

## ⚠️ 免费层 PDF 分发需手动开启

实测上传后的 PDF URL 直接访问返回 **401** —— Cloudinary 免费层默认禁止分发 PDF/ZIP(安全策略)。
存储不受影响,但"回看 PDF"需在账户 **Security → PDF and ZIP files delivery** 开启(付费层默认开)。
图片发票不受此限。已在 README/部署清单标注。

## 代价

- 上传是同步阻塞在 parse 请求里(识别本就要等 AI 数秒,多一次上传可接受)。
- 未做图片压缩/缩略图;需要时用 Cloudinary transformation URL 参数即可,无需改存储。
