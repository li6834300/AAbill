import { roundHalfAwayFromZero } from './money';

export type TaxClass = 'A' | 'B';

/**
 * 支持的账单国家(欧洲主要国家)。
 * 注意:这只决定**兜底税率**与显示标签 —— 实际税率优先取发票上印的百分比。
 */
export type TaxCountry =
  | 'AT'
  | 'BE'
  | 'BG'
  | 'CH'
  | 'CY'
  | 'CZ'
  | 'DE'
  | 'DK'
  | 'EE'
  | 'ES'
  | 'FI'
  | 'FR'
  | 'GB'
  | 'GR'
  | 'HR'
  | 'HU'
  | 'IE'
  | 'IT'
  | 'LT'
  | 'LU'
  | 'LV'
  | 'MT'
  | 'NL'
  | 'NO'
  | 'PL'
  | 'PT'
  | 'RO'
  | 'SE'
  | 'SI'
  | 'SK';

/**
 * 各税类税率,单位**基点(bp)**:19% = 1900,5.5% = 550。
 *
 * 为什么不是整数百分比:法国 5.5%、瑞士 8.1%、芬兰 25.5%、爱尔兰 13.5% 都不是整数。
 * 为什么不是浮点百分比:金额一律整数运算(ADR 0003),浮点税率会把误差带进分账取整。
 */
export type TaxRates = Record<TaxClass, number>;

/**
 * 兜底税率表:A = 标准税率,B = 食品适用的低税率。
 *
 * **这张表是兜底,不是权威。** 税率会变(芬兰 2024、爱沙尼亚 2025 都调过),
 * 且不少国家对食品还有超低/零税率(西班牙 4%、爱尔兰与英国的 0%),
 * 两档模型套不住。所以识别发票时优先读发票上印的实际百分比,
 * 只有读不出来才回落到这里。校验页会拿印刷合计交叉核对,税率用错会显示为差额。
 *
 * 数据截至 2026-07。
 */
export const DEFAULT_TAX_RATES: Record<TaxCountry, TaxRates> = {
  AT: { A: 2000, B: 1000 },
  BE: { A: 2100, B: 600 },
  BG: { A: 2000, B: 900 },
  CH: { A: 810, B: 260 },
  CY: { A: 1900, B: 500 },
  CZ: { A: 2100, B: 1200 },
  DE: { A: 1900, B: 700 },
  DK: { A: 2500, B: 2500 }, // 丹麦无低税率档
  EE: { A: 2400, B: 900 },
  ES: { A: 2100, B: 1000 },
  FI: { A: 2550, B: 1400 },
  FR: { A: 2000, B: 550 },
  GB: { A: 2000, B: 500 },
  GR: { A: 2400, B: 1300 },
  HR: { A: 2500, B: 500 },
  HU: { A: 2700, B: 500 },
  IE: { A: 2300, B: 1350 },
  IT: { A: 2200, B: 1000 },
  LT: { A: 2100, B: 900 },
  LU: { A: 1700, B: 300 },
  LV: { A: 2100, B: 1200 },
  MT: { A: 1800, B: 500 },
  NL: { A: 2100, B: 900 },
  NO: { A: 2500, B: 1500 },
  PL: { A: 2300, B: 500 },
  PT: { A: 2300, B: 600 },
  RO: { A: 1900, B: 900 },
  SE: { A: 2500, B: 1200 },
  SI: { A: 2200, B: 950 },
  SK: { A: 2300, B: 1900 },
};

/** 国家显示名(中文 + 代码),供 UI 下拉使用。 */
export const TAX_COUNTRY_NAMES: Record<TaxCountry, string> = {
  AT: '奥地利',
  BE: '比利时',
  BG: '保加利亚',
  CH: '瑞士',
  CY: '塞浦路斯',
  CZ: '捷克',
  DE: '德国',
  DK: '丹麦',
  EE: '爱沙尼亚',
  ES: '西班牙',
  FI: '芬兰',
  FR: '法国',
  GB: '英国',
  GR: '希腊',
  HR: '克罗地亚',
  HU: '匈牙利',
  IE: '爱尔兰',
  IT: '意大利',
  LT: '立陶宛',
  LU: '卢森堡',
  LV: '拉脱维亚',
  MT: '马耳他',
  NL: '荷兰',
  NO: '挪威',
  PL: '波兰',
  PT: '葡萄牙',
  RO: '罗马尼亚',
  SE: '瑞典',
  SI: '斯洛文尼亚',
  SK: '斯洛伐克',
};

export const TAX_COUNTRIES = Object.keys(DEFAULT_TAX_RATES) as TaxCountry[];

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
