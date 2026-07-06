# 架构与数据模型

完整规划见 [PRD.md](PRD.md) §5,此处为速查。

## 拓扑

```
Expo App (iOS/Android) ─┐
                        ├─→ Hono API (Heroku) ─→ Postgres
Expo Web (Vercel,      ─┘        │
 朋友免登录认领页)                ├─→ OpenAI (ReceiptParser provider)
                                 └─→ Cloudinary (发票图片)
```

- 一套 Expo 代码出三端;朋友的分享链接由 Web 版承接,免安装免注册。
- 业务计算全部在 `packages/core`(零依赖纯 TS,整数分运算),server 与 app 共用。
- 同步:MVP 5 秒轮询;二期 WebSocket。

## 数据模型

```
bills     id, owner_id, title, status(draft/claiming/locked),
          tax_country(NL/DE,决定各税类税率),
          invoice_image_url, invoice_net, invoice_vat_a, invoice_vat_b,
          invoice_gross, share_token(锁定30天后失效), created_at
families  id, bill_id, name(如"Rio家"), sort_order
items     id, bill_id, name, name_zh, qty, unit, unit_price_net,
          tax_class(A/B), is_shared(均摊), source(ai/manual), raw_text
claims    id, item_id, family_id, portion(默认1,支持按份拆分)
```

## 权限模型

| 身份 | 凭证 | 能做 |
| --- | --- | --- |
| Owner | JWT(Google/Apple 登录换取) | 账单全部操作 |
| Participant | URL 中的 share_token | 读账单、写/改 claims(锁定后只读) |

## 关键业务规则

税率按 `tax_country` 配置(NL 21%/9%,DE 19%/7%);折扣按净额比例分摊回商品;均摊商品全员平分;尾差最大余数法分配,各家之和必须精确等于发票总额;金额一律整数分。
