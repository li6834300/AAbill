# 009: Cloudinary 存原始发票

日期:2026-07-08 · 分支:m9-cloudinary

## 验收标准

- 识别时把原始发票(图片/PDF)存 Cloudinary,记 invoiceUrl;未配置存储则不落盘
- 存储失败不能阻断识别
- Owner 详情页能回看原件

## 红 → 绿

- storage.test(6 例)先行:URL 解析、null store、签名上传(校验端点/api_key/签名 sha1/file data URI)、
  上游错误、按环境选择。实现 FileStore 后绿。
- parse.test 加 3 例:存储已配置写 invoiceUrl、null store 保持 null、**存储抛错不阻断识别**。
- api-types Bill.invoiceUrl + migration 0002 + pg-repo 持久化;pg 往返测试覆盖非 null。59 server 全绿。

## 真实凭据两次冒烟

1. **上传成功**:PDF → secure_url(Cloudinary 自动识别为 image/upload)。
2. **分发被拦**:直接访问该 PDF URL 返回 401 —— 免费层默认禁 PDF/ZIP 分发。存储正常,回看需在
   账户 Security 开启开关。这个坑测出来了,写进 ADR 0008 与部署清单,免得上线后一脸问号。

## 设计取舍:存储失败为何不阻断识别

先写了"存储抛错仍 200、条目照常入库"的测试,再实现。理由:识别是主功能,存图是次要;Cloudinary
抖一下不该让用户传的发票识别失败。这条测试逼着实现里必须 try/catch 而非直接 await。

## 学到的

又一次"抽象 + 注入"省事:FileStore 跟 parser/verifier 一个模式,parse 路由多一行 `fileStore.save`,
测试用 stub store 覆盖成功/null/抛错三态,完全不碰真 Cloudinary。第三方服务的真实坑(免费层分发限制)
靠一次真凭据冒烟才暴露 —— 单测覆盖不了账户策略,该跑真的还得跑。
