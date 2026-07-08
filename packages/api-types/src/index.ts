import { z } from 'zod';

// API 边界共享 schema:金额过网络一律整数分/千分位整数(见 ADR 0003);
// AI 识别输出保持发票原貌的十进制字符串,由 server 边界统一转换。

export const TaxCountrySchema = z.enum(['DE', 'NL']);
export const TaxClassSchema = z.enum(['A', 'B']);
export const BillStatusSchema = z.enum(['draft', 'claiming', 'locked']);

export const BillCreateSchema = z.object({
  title: z.string().min(1),
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
  taxCountry: TaxCountrySchema,
  status: BillStatusSchema,
  createdAt: z.string(),
  /** 免登录分享凭证(PRD §5.3):持有者可读账单、写 claims */
  shareToken: z.string(),
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
export type ItemInput = z.infer<typeof ItemInputSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Family = z.infer<typeof FamilySchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type ClaimUpsert = z.infer<typeof ClaimUpsertSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type SessionRequest = z.infer<typeof SessionRequestSchema>;
export type PrintedTotals = z.infer<typeof PrintedTotalsSchema>;
export type Bill = z.infer<typeof BillSchema>;
export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>;
