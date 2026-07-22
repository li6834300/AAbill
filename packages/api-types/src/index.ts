import { TAX_COUNTRIES } from '@aabill/core';
import { z } from 'zod';

// API 边界共享 schema:金额过网络一律整数分/千分位整数(见 ADR 0003);
// AI 识别输出保持发票原貌的十进制字符串,由 server 边界统一转换。

// 国家清单与兜底税率同源于 core —— 避免两处各写一份、悄悄漂移
export const TaxCountrySchema = z.enum(TAX_COUNTRIES);

/** 实际生效的税率,单位基点(19% = 1900)。优先取发票印刷值,读不出才用国家表。 */
export const TaxRatesSchema = z.object({
  A: z.number().int().nonnegative(),
  B: z.number().int().nonnegative(),
});
export const TaxClassSchema = z.enum(['A', 'B']);

/**
 * 支持的译名语言。商品译名跟着**账单**走(识别时定下),不跟界面语言走 ——
 * 切界面语言不会重译已有条目,那需要重新识别整张发票。
 */
export const LangSchema = z.enum(['zh', 'en', 'nl', 'de']);
export const BillStatusSchema = z.enum(['draft', 'claiming', 'locked']);

export const BillCreateSchema = z.object({
  title: z.string().min(1),
  /** 建单时通常还没看到发票 —— 留空,识别时由 AI 读出;读不出再让用户选 */
  taxCountry: TaxCountrySchema.optional(),
});

/** 识别不出税制时,由用户人工指定 */
export const TaxCountrySetSchema = z.object({
  taxCountry: TaxCountrySchema,
  /** 该国有多档低税率时必填(基点),否则无从判定食品适用哪档 */
  reducedRateBp: z.number().int().nonnegative().optional(),
});

export const ItemInputSchema = z.object({
  name: z.string().min(1),
  /** AI 按账单语言给出的译名;语言见 bill.translationLang */
  nameTranslated: z.string().default(''),
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
  nameTranslated: z.string().optional(),
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
  /** 商品译名所用的语言;null = 还没识别过 */
  translationLang: LangSchema.nullable(),
  /** null = 尚未确定税制(AI 没识别出且用户还没选)。仅作标签与税率兜底来源 */
  taxCountry: TaxCountrySchema.nullable(),
  /** 算钱真正用的税率(基点)。null = 无从计税,校验/结算/锁定一律挡下 */
  taxRates: TaxRatesSchema.nullable(),
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
  nameTranslated: z.string(),
  qty: decimalMilli,
  unit: z.string(),
  unitPriceNet: decimalMilli,
  /** 发票印刷的行总额(Wert):识别应优先读它,可 0 差额对账 */
  lineNet: decimalCents,
  taxClass: TaxClassSchema,
});

export const ParsedReceiptSchema = z.object({
  /** 从发票上读出的**开票方**国家;读不出返回 UNKNOWN,由用户指定 */
  detectedTaxCountry: z.enum([...TAX_COUNTRIES, 'UNKNOWN']),
  /**
   * 发票税额汇总栏印的实际税率百分比,原样字符串("19,00"、"5.5")。
   * 读不出留空串 —— 这才是权威税率,国家表只是兜底。
   */
  detectedRates: z.object({ A: z.string(), B: z.string() }),
  items: z.array(ParsedItemSchema),
  totals: z.object({
    net: decimalCents,
    vatA: decimalCents,
    vatB: decimalCents,
    gross: decimalCents,
  }),
});

export type Lang = z.infer<typeof LangSchema>;
export type TaxCountry = z.infer<typeof TaxCountrySchema>;
export type TaxRates = z.infer<typeof TaxRatesSchema>;
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
