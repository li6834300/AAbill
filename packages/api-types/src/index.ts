import { z } from 'zod';

// API 边界共享 schema:金额过网络一律整数分/千分位整数(见 ADR 0003);
// AI 识别输出保持发票原貌的十进制字符串,由 server 边界统一转换。

export const TaxCountrySchema = z.enum(['DE', 'NL']);
export const TaxClassSchema = z.enum(['A', 'B']);
export const BillStatusSchema = z.enum(['draft', 'claiming', 'locked']);

export const BillCreateSchema = z.object({
  title: z.string().min(1),
  /** 建单时通常还没看到发票 —— 留空,识别时由 AI 读出;读不出再让用户选 */
  taxCountry: TaxCountrySchema.optional(),
});

/** 识别不出税制时,由用户人工指定 */
export const TaxCountrySetSchema = z.object({
  taxCountry: TaxCountrySchema,
});

export const ItemInputSchema = z.object({
  name: z.string().min(1),
  nameZh: z.string().default(''),
  qtyMilli: z.number().int().positive(),
  unit: z.string().default('ST'),
  unitPriceMilli: z.number().int(),
  taxClass: TaxClassSchema,
  isShared: z.boolean().default(false),
  printedLineNetCents: z.number().int().optional(),
});

/**
 * 条目局部修改:全部可选且**不带默认值**。
 * 不能用 ItemInputSchema.partial() —— 那样 zod 会给未提交的字段补默认值,
 * PATCH 时会静默清空中文名、把单位重置成 ST、取消均摊标记。
 */
export const ItemPatchSchema = z.object({
  name: z.string().min(1).optional(),
  nameZh: z.string().optional(),
  qtyMilli: z.number().int().positive().optional(),
  unit: z.string().optional(),
  unitPriceMilli: z.number().int().optional(),
  taxClass: TaxClassSchema.optional(),
  isShared: z.boolean().optional(),
  printedLineNetCents: z.number().int().optional(),
});

export const ItemSchema = ItemInputSchema.extend({
  id: z.string(),
  source: z.enum(['ai', 'manual']),
});

export const FamilySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

export const PrintedTotalsSchema = z.object({
  netCents: z.number().int(),
  vatByClass: z.object({ A: z.number().int(), B: z.number().int() }),
  grossCents: z.number().int(),
});

/** 认领(PRD C2):同一商品可多家按份共享 */
export const ClaimSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  familyId: z.string(),
  portion: z.number().int().positive(),
  updatedAt: z.string(),
});

/** 认领写入:portion=0 表示取消认领 */
export const ClaimUpsertSchema = z.object({
  itemId: z.string(),
  familyId: z.string(),
  portion: z.number().int().nonnegative(),
});

/**
 * 一件商品可被认领的「件数」。
 * portion 的语义是**实际认领的件数**(不是相对权重),各家之和不得超过此值。
 * - 整数件商品(3 ST → qtyMilli 3000):可分 3 件
 * - 计重商品(2.871 kg → qtyMilli 2871):是一整块,只能整件认领 → 1
 */
export function claimableUnits(qtyMilli: number): number {
  return qtyMilli > 0 && qtyMilli % 1000 === 0 ? qtyMilli / 1000 : 1;
}

/** 批量提交某个家庭的认领:整体替换该家庭在本账单的认领 */
export const ClaimBatchSchema = z.object({
  familyId: z.string(),
  claims: z.array(
    z.object({
      itemId: z.string(),
      portion: z.number().int().positive(),
    }),
  ),
});

export const AuthUserSchema = z.object({
  sub: z.string(),
  email: z.string(),
});

export const SessionRequestSchema = z.object({
  provider: z.string().min(1),
  idToken: z.string().min(1),
});

export const BillSchema = z.object({
  id: z.string(),
  /** 归属 Owner(JWT sub);Participant 无归属 */
  ownerId: z.string(),
  title: z.string(),
  /** null = 尚未确定税制(AI 没识别出且用户还没选) */
  taxCountry: TaxCountrySchema.nullable(),
  status: BillStatusSchema,
  createdAt: z.string(),
  /** 免登录分享凭证(PRD §5.3):持有者可读账单、写 claims */
  shareToken: z.string(),
  /** 原始发票文件 URL(Cloudinary);未上传/未配置存储时为 null */
  invoiceUrl: z.string().nullable(),
  printedTotals: PrintedTotalsSchema.nullable(),
  items: z.array(ItemSchema),
  families: z.array(FamilySchema),
  claims: z.array(ClaimSchema),
});

/** 数量/单价:最多 3 位小数(千分位) */
const decimalMilli = z.string().regex(/^\d+(\.\d{1,3})?$/);
/** 金额:最多 2 位小数(分) */
const decimalCents = z.string().regex(/^\d+(\.\d{1,2})?$/);

export const ParsedItemSchema = z.object({
  name: z.string().min(1),
  nameZh: z.string(),
  qty: decimalMilli,
  unit: z.string(),
  unitPriceNet: decimalMilli,
  /** 发票印刷的行总额(Wert):识别应优先读它,可 0 差额对账 */
  lineNet: decimalCents,
  taxClass: TaxClassSchema,
});

export const ParsedReceiptSchema = z.object({
  /** 从发票上读出的国家/税制;读不出返回 UNKNOWN,由用户指定 */
  detectedTaxCountry: z.enum(['DE', 'NL', 'UNKNOWN']),
  items: z.array(ParsedItemSchema),
  totals: z.object({
    net: decimalCents,
    vatA: decimalCents,
    vatB: decimalCents,
    gross: decimalCents,
  }),
});

export type TaxCountry = z.infer<typeof TaxCountrySchema>;
export type TaxClass = z.infer<typeof TaxClassSchema>;
export type BillStatus = z.infer<typeof BillStatusSchema>;
export type BillCreate = z.infer<typeof BillCreateSchema>;
export type TaxCountrySet = z.infer<typeof TaxCountrySetSchema>;
export type ItemInput = z.infer<typeof ItemInputSchema>;
export type ItemPatch = z.infer<typeof ItemPatchSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Family = z.infer<typeof FamilySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type ClaimUpsert = z.infer<typeof ClaimUpsertSchema>;
export type ClaimBatch = z.infer<typeof ClaimBatchSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type SessionRequest = z.infer<typeof SessionRequestSchema>;
export type PrintedTotals = z.infer<typeof PrintedTotalsSchema>;
export type Bill = z.infer<typeof BillSchema>;
export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
