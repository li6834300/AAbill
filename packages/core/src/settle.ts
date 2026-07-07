import { allocateByLargestRemainder } from './allocate.js';
import { vatCents, type TaxClass, type TaxRates } from './tax.js';
import {
  itemNetCents,
  type BillItem,
  type ComputedTotals,
} from './validate.js';

export interface Claim {
  familyId: string;
  /** 份数,正整数(PRD C2:同一商品可多家按份共享) */
  portion: number;
}

export interface SettleItem extends BillItem {
  name?: string;
  /** 均摊:由全部家庭平分,与 claims 互斥 */
  isShared?: boolean;
  claims?: Claim[];
}

export interface FamilySettlement {
  familyId: string;
  netByClass: Record<TaxClass, number>;
  netCents: number;
  vatByClass: Record<TaxClass, number>;
  vatCents: number;
  grossCents: number;
}

export interface SettleResult {
  families: FamilySettlement[];
  totals: ComputedTotals;
}

/**
 * AA 结算(PRD D2):商品净额按份数/均摊拆给家庭,分类税额按各家该类净额
 * 比例分摊,尾差一律最大余数法;Σ家庭 gross 精确等于账单计算 gross。
 */
export function settle(input: {
  items: SettleItem[];
  families: string[];
  rates: TaxRates;
}): SettleResult {
  const { items, families, rates } = input;
  if (families.length === 0) throw new Error('家庭列表不能为空');
  const familySet = new Set(families);
  const netPerFamily = families.map((): Record<TaxClass, number> => ({
    A: 0,
    B: 0,
  }));

  items.forEach((item, idx) => {
    const label = item.name ?? `第 ${idx + 1} 行`;
    const claims = item.claims ?? [];
    if (item.isShared && claims.length > 0) {
      throw new Error(`商品「${label}」同时标记了均摊与认领,语义冲突`);
    }
    if (!item.isShared && claims.length === 0) {
      throw new Error(`商品「${label}」未认领且未标记均摊,无法结算`);
    }
    for (const claim of claims) {
      if (!familySet.has(claim.familyId)) {
        throw new Error(
          `商品「${label}」被不存在的家庭认领: ${claim.familyId}`,
        );
      }
      if (!Number.isInteger(claim.portion) || claim.portion <= 0) {
        throw new Error(
          `商品「${label}」份数必须为正整数,收到 ${claim.portion}`,
        );
      }
    }

    const weights = item.isShared
      ? families.map(() => 1)
      : families.map((familyId) =>
          claims
            .filter((c) => c.familyId === familyId)
            .reduce((sum, c) => sum + c.portion, 0),
        );

    // shares 与 netPerFamily 均按 families 下标对齐,长度一致
    const shares = allocateByLargestRemainder(itemNetCents(item), weights);
    netPerFamily.forEach((net, fi) => {
      /* v8 ignore next -- 下标对齐,?? 回退不可达 */
      net[item.taxClass] += shares[fi] ?? 0;
    });
  });

  const netByClass: Record<TaxClass, number> = {
    A: netPerFamily.reduce((sum, n) => sum + n.A, 0),
    B: netPerFamily.reduce((sum, n) => sum + n.B, 0),
  };
  const vatByClass: Record<TaxClass, number> = {
    A: vatCents(netByClass.A, rates.A),
    B: vatCents(netByClass.B, rates.B),
  };
  // 分类税额按各家该类净额比例分摊;税额为 0 时无需分摊(也避免全零权重)
  const vatSharesOf = (taxClass: TaxClass): number[] =>
    vatByClass[taxClass] === 0
      ? families.map(() => 0)
      : allocateByLargestRemainder(
          vatByClass[taxClass],
          netPerFamily.map((n) => n[taxClass]),
        );
  const vatSharesA = vatSharesOf('A');
  const vatSharesB = vatSharesOf('B');

  const familySettlements = families.map((familyId, fi): FamilySettlement => {
    /* v8 ignore next 4 -- 下标对齐,?? 回退不可达 */
    const net = netPerFamily[fi] ?? { A: 0, B: 0 };
    const vat: Record<TaxClass, number> = {
      A: vatSharesA[fi] ?? 0,
      B: vatSharesB[fi] ?? 0,
    };
    const netCents = net.A + net.B;
    const vatTotal = vat.A + vat.B;
    return {
      familyId,
      netByClass: net,
      netCents,
      vatByClass: vat,
      vatCents: vatTotal,
      grossCents: netCents + vatTotal,
    };
  });

  const netCents = netByClass.A + netByClass.B;
  return {
    families: familySettlements,
    totals: {
      netByClass,
      netCents,
      vatByClass,
      grossCents: netCents + vatByClass.A + vatByClass.B,
    },
  };
}
