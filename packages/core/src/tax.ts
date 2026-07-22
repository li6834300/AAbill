import { roundHalfAwayFromZero } from './money';
import { VAT_RATES, VAT_RATES_SOURCE } from './vat-rates.generated';

export { VAT_RATES_SOURCE };

export type TaxClass = 'A' | 'B';

/** 支持的账单国家。清单由 scripts/sync-vat-rates.mjs 从欧委会 TEDB 生成。 */
export type TaxCountry = keyof typeof VAT_RATES;

/**
 * 各税类税率,单位**基点(bp)**:19% = 1900,5.5% = 550。
 *
 * 为什么不是整数百分比:法国 5.5%、瑞士 8.1%、芬兰 25.5% 都不是整数。
 * 为什么不是浮点百分比:金额一律整数运算(ADR 0003),浮点税率会把误差带进分账取整。
 */
export type TaxRates = Record<TaxClass, number>;

export const TAX_COUNTRIES = Object.keys(VAT_RATES) as TaxCountry[];

/** 国家显示名(上游英文国名),供 UI 下拉使用。 */
export const TAX_COUNTRY_NAMES: Record<TaxCountry, string> = Object.fromEntries(
  TAX_COUNTRIES.map((c) => [c, VAT_RATES[c].name]),
) as Record<TaxCountry, string>;

/**
 * 某国全部低税率档(基点,升序)。
 * 一国常有多档(卢森堡 3/8/14),食品适用哪档因国而异 ——
 * 所以这只是候选清单,真正算钱以发票印刷的税率为准。
 */
export function reducedRateOptions(country: TaxCountry): number[] {
  return [...VAT_RATES[country].reducedBp];
}

/**
 * 该国的低税率是否**无法自动判定**。
 *
 * 一国常有多档低税率,而「食品适用哪一档」推导不出来:法国上游给出
 * [0.9, 1.05, 5.5, 8.5, 10, 13](含海外省与科西嘉特别税率),取最低会选中 0.9%,
 * 荒谬且会算错钱。故多档时一律交给用户选,不替他猜。
 */
export function isReducedRateAmbiguous(country: TaxCountry): boolean {
  return VAT_RATES[country].reducedBp.length > 1;
}

/**
 * 兜底税率表:A = 标准税率,B = 该国唯一的一档低税率
 * (没有低税率档则同标准税率;有多档时取最低,但此时 isReducedRateAmbiguous 为真,
 * 调用方应改为询问用户而不是直接采用这个值)。
 *
 * **这是兜底,不是权威。** 数据来自欧委会 TEDB(见 VAT_RATES_SOURCE.version),
 * 但「食品该用哪一档」因国而异,两档模型套不住多档现实。
 * 所以识别发票时优先读发票上印的实际百分比,只有读不出来才回落到这里。
 */
export const DEFAULT_TAX_RATES: Record<TaxCountry, TaxRates> =
  Object.fromEntries(
    TAX_COUNTRIES.map((c) => {
      const { standardBp, reducedBp } = VAT_RATES[c];
      return [c, { A: standardBp, B: reducedBp[0] ?? standardBp }];
    }),
  ) as Record<TaxCountry, TaxRates>;

/**
 * 发票印刷的税率百分比 → 基点。
 * 欧洲发票用逗号做小数点("19,00 %"),可带百分号与空白。
 * 解析不出、超过 2 位小数、为负或大于 100 一律抛错 —— 宁可回落到国家表,也不猜。
 */
export function bpFromPercent(printed: string): number {
  const cleaned = printed.replace(/[%\s]/g, '').replace(',', '.');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) throw new Error(`无法解析税率百分比: "${printed}"`);
  const [, int, frac = ''] = m;
  const bp = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  if (bp > 10_000) throw new Error(`税率超出合理范围: "${printed}"`);
  return bp;
}

/** 行净额(分)= qty(千分位)× 折后净单价(千分位欧),四舍五入到分。 */
export function lineNetCents(qtyMilli: number, unitPriceMilli: number): number {
  return roundHalfAwayFromZero(qtyMilli * unitPriceMilli, 10_000);
}

/** 税额(分)= 净额(分)× 基点税率,四舍五入到分。 */
export function vatCents(netCents: number, rateBp: number): number {
  return roundHalfAwayFromZero(netCents * rateBp, 10_000);
}
