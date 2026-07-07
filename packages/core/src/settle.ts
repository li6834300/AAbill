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
  const familyIndex = new Map(families.map((f, i) => [f, i]));
  const netPerFamily = families.map((): Record<TaxClass, number> => ({
    A: 0,
    B: 0,
  }));

  items.forEach((item, idx) => {
    const label = item.name ?? `第 ${idx + 1} 行`;
    const hasClaims = (item.claims?.length ?? 0) > 0;
    if (item.isShared && hasClaims) {
      throw new Error(`商品「${label}」同时标记了均摊与认领,语义冲突`);
    }
    if (!item.isShared && !hasClaims) {
      throw new Error(`商品「${label}」未认领且未标记均摊,无法结算`);
    }

    const weights = families.map(() => 0);
    if (item.isShared) {
      weights.fill(1);
    } else {
      for (const claim of item.claims ?? []) {
        const fi = familyIndex.get(claim.familyId);
        if (fi === undefined) {
          throw new Error(
            `商品「${label}」被不存在的家庭认领: ${claim.familyId}`,
          );
        }
        if (!Number.isInteger(claim.portion) || claim.portion <= 0) {
          throw new Error(
            `商品「${label}」份数必须为正整数,收到 ${claim.portion}`,
          );
        }
        weights[fi] = (weights[fi] ?? 0) + claim.portion;
      }
    }

    const shares = allocateByLargestRemainder(itemNetCents(item), weights);
    shares.forEach((share, fi) => {
      const net = netPerFamily[fi];
      if (net) net[item.taxClass] += share;
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
  const vatShares: Record<TaxClass, number[]> = {
    A:
      vatByClass.A === 0
        ? families.map(() => 0)
        : allocateByLargestRemainder(
            vatByClass.A,
            netPerFamily.map((n) => n.A),
          ),
    B:
      vatByClass.B === 0
        ? families.map(() => 0)
        : allocateByLargestRemainder(
            vatByClass.B,
            netPerFamily.map((n) => n.B),
          ),
  };

  const familySettlements = families.map((familyId, fi): FamilySettlement => {
    const net = netPerFamily[fi] ?? { A: 0, B: 0 };
    const vat: Record<TaxClass, number> = {
      A: vatShares.A[fi] ?? 0,
      B: vatShares.B[fi] ?? 0,
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
