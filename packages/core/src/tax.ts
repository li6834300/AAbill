import { roundHalfAwayFromZero } from './money';

export type TaxClass = 'A' | 'B';
export type TaxCountry = 'DE' | 'NL';

/** 各税类的整数百分比税率,按账单国家配置。 */
export type TaxRates = Record<TaxClass, number>;

export const DEFAULT_TAX_RATES: Record<TaxCountry, TaxRates> = {
  DE: { A: 19, B: 7 },
  NL: { A: 21, B: 9 },
};

/** 行净额(分)= qty(千分位)× 折后净单价(千分位欧),四舍五入到分。 */
export function lineNetCents(qtyMilli: number, unitPriceMilli: number): number {
  return roundHalfAwayFromZero(qtyMilli * unitPriceMilli, 10_000);
}

/** 税额(分)= 净额(分)× 整数百分比税率,四舍五入到分。 */
export function vatCents(netCents: number, ratePercent: number): number {
  return roundHalfAwayFromZero(netCents * ratePercent, 100);
}
