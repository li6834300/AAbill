import { claimableUnits, type TaxRates } from '@aabill/api-types';
import { vatCents } from '@aabill/core';
import type { ItemView } from '../components/ItemRow';

export interface ClaimTotals {
  /** 净额(分) */
  netCents: number;
  /** 含税额(分);rates 为 null 时等于净额 */
  grossCents: number;
  /** 已选商品种数 */
  kinds: number;
  /** 已选总件数 */
  units: number;
}

/** 一件的净额(分):计重商品按整块 = 重量 × 单价;计件商品 = 单价 */
function perUnitCents(i: ItemView): number {
  const isWeight = claimableUnits(i.qtyMilli) === 1 && i.qtyMilli % 1000 !== 0;
  return isWeight
    ? Math.round((i.qtyMilli * i.unitPriceMilli) / 10000)
    : Math.round(i.unitPriceMilli / 10);
}

/**
 * 认领底栏的实时汇总。均摊商品不计入(由全家庭平分,不属于个人认领)。
 * 税制未定(rates=null)时只给净额,含税额退化为净额。
 */
export function claimTotals(
  items: ItemView[],
  draft: Record<string, number>,
  rates: TaxRates | null,
): ClaimTotals {
  const chosen = items.filter((i) => !i.isShared && (draft[i.id] ?? 0) > 0);
  let netCents = 0;
  let vat = 0;
  let units = 0;
  for (const i of chosen) {
    const portion = draft[i.id] ?? 0;
    const lineNet = portion * perUnitCents(i);
    netCents += lineNet;
    if (rates) vat += vatCents(lineNet, rates[i.taxClass]);
    units += portion;
  }
  return {
    netCents,
    grossCents: netCents + vat,
    kinds: chosen.length,
    units,
  };
}
